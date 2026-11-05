
import { createClient } from
  "https://esm.sh/@supabase/supabase-js@2";

// =====================================================
// NOH OPPORTUNITY PUBLISHER
// Supabase Edge Function
// =====================================================

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;

const SUPABASE_ANON_KEY =
  Deno.env.get("SUPABASE_ANON_KEY")!;

const SUPABASE_SERVICE_ROLE_KEY =
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const ALLOWED_ORIGINS = new Set([
  "https://naijaopportunityhub.com.ng",
  "https://www.naijaopportunityhub.com.ng",
  "https://opportunity-naija.edreessaleesu.workers.dev",
  "http://localhost:5500",
  "http://127.0.0.1:5500",
  "http://localhost:3000",
  "http://127.0.0.1:3000"
]);

const ALLOWED_CATEGORIES = [
  "Scholarship",
  "Job",
  "Internship",
  "Grant",
  "Fellowship",
  "Training",
  "Other"
];

const MAX_BATCH_SIZE = 100;

// =====================================================
// CORS
// =====================================================

function corsHeaders(origin: string | null) {
  const headers: Record<string, string> = {
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",

    "Access-Control-Allow-Methods":
      "POST, OPTIONS",

    "Access-Control-Max-Age": "86400",

    "Vary": "Origin"
  };

  if (origin && ALLOWED_ORIGINS.has(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
  }

  return headers;
}

// =====================================================
// RESPONSE HELPER
// =====================================================

function jsonResponse(
  body: Record<string, unknown>,
  status = 200,
  origin: string | null = null
) {
  return new Response(
    JSON.stringify(body),
    {
      status,
      headers: {
        ...corsHeaders(origin),
        "Content-Type": "application/json"
      }
    }
  );
}

// =====================================================
// TEXT AND URL HELPERS
// =====================================================

function cleanText(
  value: unknown,
  maxLength: number
): string {
  if (typeof value !== "string") return "";

  return value.trim().slice(0, maxLength);
}

function validHttpsUrl(value: string): boolean {
  try {
    const url = new URL(value);

    return (
      url.protocol === "https:" &&
      Boolean(url.hostname)
    );
  } catch {
    return false;
  }
}

function normaliseTitle(value: string): string {
  return value
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function validDeadline(value: unknown): boolean {
  if (value === null || value === undefined || value === "") {
    return true;
  }

  if (typeof value !== "string") {
    return false;
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const date = new Date(`${value}T00:00:00.000Z`);

  return (
    !Number.isNaN(date.getTime()) &&
    date.toISOString().slice(0, 10) === value
  );
}

// =====================================================
// AUTHENTICATION
// =====================================================

async function authenticateAdmin(request: Request) {
  const authHeader = request.headers.get("Authorization");

  if (!authHeader?.startsWith("Bearer ")) {
    throw new Error("Missing or invalid authorisation token.");
  }

  const token = authHeader.slice(7).trim();

  if (!token) {
    throw new Error("Authentication token is empty.");
  }

  const authClient = createClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      }
    }
  );

  const {
    data: { user },
    error
  } = await authClient.auth.getUser(token);

  if (error || !user) {
    throw new Error("Your session is invalid or has expired.");
  }

  if (user.app_metadata?.role !== "admin") {
    throw new Error("Administrator permission is required.");
  }

  return user;
}

// =====================================================
// OPPORTUNITY VALIDATION
// =====================================================

function validateOpportunity(input: unknown) {
  if (
    !input ||
    typeof input !== "object" ||
    Array.isArray(input)
  ) {
    throw new Error("Each opportunity must be an object.");
  }

  const item = input as Record<string, unknown>;

  const title = cleanText(item.title, 250);

  const organization = cleanText(
    item.organization,
    200
  );

  const category = cleanText(
    item.category,
    50
  );

  const description = cleanText(
    item.description,
    12000
  );

  const eligibility = cleanText(
    item.eligibility,
    5000
  );

  const location = cleanText(
    item.location,
    150
  );

  const applicationUrl = cleanText(
    item.application_url,
    2000
  );

  const sourceUrl = cleanText(
    item.source_url,
    2000
  );

  const deadline =
    item.deadline === null ||
    item.deadline === undefined ||
    item.deadline === ""
      ? null
      : cleanText(item.deadline, 10);

  const status = cleanText(
    item.status || "pending",
    20
  ).toLowerCase();

  if (!title) {
    throw new Error("Opportunity title is required.");
  }

  if (!organization) {
    throw new Error(
      `Organisation is required for "${title}".`
    );
  }

  if (!ALLOWED_CATEGORIES.includes(category)) {
    throw new Error(
      `Invalid category for "${title}".`
    );
  }

  if (!description) {
    throw new Error(
      `Description is required for "${title}".`
    );
  }

  if (!applicationUrl || !validHttpsUrl(applicationUrl)) {
    throw new Error(
      `A valid HTTPS application link is required for "${title}".`
    );
  }

  if (
    sourceUrl &&
    !validHttpsUrl(sourceUrl)
  ) {
    throw new Error(
      `The source link for "${title}" must be a valid HTTPS URL.`
    );
  }

  if (!validDeadline(deadline)) {
    throw new Error(
      `The deadline for "${title}" is invalid.`
    );
  }

  if (!["pending", "published"].includes(status)) {
    throw new Error(
      `Invalid publication status for "${title}".`
    );
  }

  if (status === "published" && deadline) {
    const today = new Date()
      .toISOString()
      .slice(0, 10);

    if (deadline < today) {
      throw new Error(
        `Cannot publish "${title}" because its application deadline has passed.`
      );
    }
  }

  return {
    title,
    organization,
    category,
    description,
    eligibility: eligibility || null,
    location: location || null,
    deadline,
    application_url: applicationUrl,
    source_url: sourceUrl || null,
    status
  };
}

// =====================================================
// DASHBOARD STATISTICS
// =====================================================

async function getStats(adminClient: ReturnType<typeof createClient>) {
  const [
    totalResult,
    publishedResult,
    pendingResult
  ] = await Promise.all([
    adminClient
      .from("opportunities")
      .select("id", { count: "exact", head: true }),

    adminClient
      .from("opportunities")
      .select("id", { count: "exact", head: true })
      .eq("status", "published"),

    adminClient
      .from("opportunities")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending")
  ]);

  const errors = [
    totalResult.error,
    publishedResult.error,
    pendingResult.error
  ].filter(Boolean);

  if (errors.length) {
    throw new Error(
      errors.map(error => error!.message).join("; ")
    );
  }

  return {
    total: totalResult.count ?? 0,
    published: publishedResult.count ?? 0,
    pending: pendingResult.count ?? 0
  };
}

// =====================================================
// PUBLISH OPPORTUNITIES
// =====================================================

async function publishOpportunities(
  adminClient: ReturnType<typeof createClient>,
  body: Record<string, unknown>
) {
  const rawOpportunities = body.opportunities;

  if (!Array.isArray(rawOpportunities)) {
    throw new Error(
      "The opportunities field must be an array."
    );
  }

  if (rawOpportunities.length === 0) {
    throw new Error("No opportunities were supplied.");
  }

  if (rawOpportunities.length > MAX_BATCH_SIZE) {
    throw new Error(
      `A maximum of ${MAX_BATCH_SIZE} opportunities can be submitted at once.`
    );
  }

  const verifiedConfirmation =
    body.verified_confirmation === true;

  // Validate the complete batch before inserting anything.
  const opportunities = rawOpportunities.map(
    (item, index) => {
      try {
        return validateOpportunity(item);
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Invalid opportunity.";

        throw new Error(
          `Opportunity ${index + 1}: ${message}`
        );
      }
    }
  );

  const hasPublished = opportunities.some(
    item => item.status === "published"
  );

  if (hasPublished && !verifiedConfirmation) {
    throw new Error(
      "Verification confirmation is required before publishing."
    );
  }

  // Remove duplicate titles within the submitted batch.
  const batchTitles = new Set<string>();

  const uniqueOpportunities = [];
  const skipped: Array<{
    title: string;
    reason: string;
  }> = [];

  for (const item of opportunities) {
    const key = normaliseTitle(item.title);

    if (batchTitles.has(key)) {
      skipped.push({
        title: item.title,
        reason: "Duplicate title within this batch."
      });

      continue;
    }

    batchTitles.add(key);
    uniqueOpportunities.push(item);
  }

  if (uniqueOpportunities.length === 0) {
    return {
      success: true,
      inserted: 0,
      duplicates: skipped.length,
      skipped
    };
  }

  // Check existing titles in the database.
  const submittedTitles = uniqueOpportunities.map(
    item => item.title
  );

  const {
    data: existingRecords,
    error: lookupError
  } = await adminClient
    .from("opportunities")
    .select("title")
    .in("title", submittedTitles);

  if (lookupError) {
    throw new Error(
      `Duplicate check failed: ${lookupError.message}`
    );
  }

  const existingTitles = new Set(
    (existingRecords || []).map(
      record => normaliseTitle(record.title || "")
    )
  );

  const recordsToInsert = [];

  for (const item of uniqueOpportunities) {
    const key = normaliseTitle(item.title);

    if (existingTitles.has(key)) {
      skipped.push({
        title: item.title,
        reason: "An opportunity with this title already exists."
      });

      continue;
    }

    const record: Record<string, unknown> = {
      ...item
    };

    if (
      item.status === "published" &&
      verifiedConfirmation
    ) {
      record.verified_at = new Date().toISOString();
    }

    recordsToInsert.push(record);
  }

  if (recordsToInsert.length === 0) {
    return {
      success: true,
      inserted: 0,
      duplicates: skipped.length,
      skipped
    };
  }

  // Insert using the server-side service role client.
  const {
    data: insertedRecords,
    error: insertError
  } = await adminClient
    .from("opportunities")
    .insert(recordsToInsert)
    .select("id, title, category, status");

  if (insertError) {
    throw new Error(
      `Database insertion failed: ${insertError.message}`
    );
  }

  return {
    success: true,
    inserted: insertedRecords?.length ?? 0,
    duplicates: skipped.length,
    skipped,
    records: insertedRecords ?? []
  };
}

// =====================================================
// MAIN EDGE FUNCTION
// =====================================================

Deno.serve(async (request: Request) => {
  const origin = request.headers.get("Origin");

  if (request.method === "OPTIONS") {
    if (origin && !ALLOWED_ORIGINS.has(origin)) {
      return jsonResponse(
        { error: "Origin not allowed." },
        403,
        null
      );
    }

    return new Response("ok", {
      headers: corsHeaders(origin)
    });
  }

  if (request.method !== "POST") {
    return jsonResponse(
      { error: "Method not allowed." },
      405,
      origin
    );
  }

  if (origin && !ALLOWED_ORIGINS.has(origin)) {
    return jsonResponse(
      { error: "Origin not allowed." },
      403,
      null
    );
  }

  try {
    if (
      !SUPABASE_URL ||
      !SUPABASE_ANON_KEY ||
      !SUPABASE_SERVICE_ROLE_KEY
    ) {
      throw new Error(
        "The publishing function is missing required server configuration."
      );
    }

    // Confirm the administrator's identity and role.
    await authenticateAdmin(request);

    // Create the privileged client only on the server.
    const adminClient = createClient(
      SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false
        }
      }
    );

    const body = await request.json();

    if (
      !body ||
      typeof body !== "object" ||
      Array.isArray(body)
    ) {
      throw new Error("Invalid request body.");
    }

    const action = body.action;

    if (action === "stats") {
      const stats = await getStats(adminClient);

      return jsonResponse(
        {
          success: true,
          ...stats
        },
        200,
        origin
      );
    }

    if (action === "publish") {
      const result = await publishOpportunities(
        adminClient,
        body
      );

      return jsonResponse(
        result,
        200,
        origin
      );
    }

    return jsonResponse(
      { error: "Unknown action." },
      400,
      origin
    );

  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "An unexpected server error occurred.";

    const status =
      message.toLowerCase().includes("administrator") ||
      message.toLowerCase().includes("authorisation") ||
      message.toLowerCase().includes("session")
        ? 401
        : 400;

    return jsonResponse(
      {
        success: false,
        error: message
      },
      status,
      origin
    );
  }
});
