(() => {
  "use strict";
  const SUPABASE_URL = "https://djxornmwvkauhkcuhgxc.supabase.co";
  const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_EDReCY3JcN4vMuypVfqcMQ_GcTEVuBq";
  const $ = id => document.getElementById(id);
  let db = null;
  let currentRows = [];
  let busy = false;
  const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[c]);
  const safeHttps = value => { try { const u = new URL(String(value)); return u.protocol === "https:" ? u.href : ""; } catch { return ""; } };
  function notice(message, error = false) { $("notice").textContent = message; $("notice").classList.toggle("error", error); }
  function dateLabel(value) { if (!value) return "Date not supplied"; const d = new Date(value); return Number.isNaN(d.getTime()) ? "Date not supplied" : d.toLocaleString("en-GB", {dateStyle:"medium",timeStyle:"short"}); }
  async function requireAdmin() {
    const {data:{session},error} = await db.auth.getSession();
    if (error || !session?.user) throw new Error("Sign in to your NOH administrator account first, then reopen this page.");
    const {data:admin,error:adminError} = await db.from("admins").select("user_id").eq("user_id",session.user.id).maybeSingle();
    if (adminError || !admin) throw new Error("This account is not listed as a NOH administrator.");
    return session.user;
  }
  async function loadStats() {
    const [{count:pending,error:pErr},{count:imported,error:iErr},{data:runs,error:rErr}] = await Promise.all([
      db.from("noh_discovered_opportunities").select("id",{count:"exact",head:true}).eq("status","pending"),
      db.from("noh_discovered_opportunities").select("id",{count:"exact",head:true}).eq("status","imported"),
      db.from("noh_discovery_runs").select("finished_at,entries_added,errors").order("id",{ascending:false}).limit(1)
    ]);
    if (pErr || iErr || rErr) throw pErr || iErr || rErr;
    $("pendingCount").textContent = pending ?? 0;
    $("importedCount").textContent = imported ?? 0;
    $("lastRun").textContent = runs?.[0]?.finished_at ? dateLabel(runs[0].finished_at) : "Not run yet";
  }
  function render() {
    const status = $("statusFilter").value;
    const term = $("searchInput").value.trim().toLocaleLowerCase("en-GB");
    const rows = currentRows.filter(row => (status === "all" || row.status === status) && (!term || `${row.title} ${row.source_name} ${row.summary || ""}`.toLocaleLowerCase("en-GB").includes(term)));
    if (!rows.length) { $("queue").innerHTML = '<div class="empty">No entries match this view. New discoveries will appear here after the next scheduled run.</div>'; return; }
    $("queue").innerHTML = rows.map(row => `
      <article class="entry" data-id="${esc(row.id)}">
        <div><div class="entry-meta"><span class="pill">${esc(row.status)}</span> · ${esc(row.source_name)} · Discovered ${esc(dateLabel(row.discovered_at))}</div>
          <h3>${esc(row.title)}</h3><p>${esc(row.summary || "No summary supplied by feed. Open the source and verify the details.")}</p>
          <p class="entry-meta">Published by source: ${esc(dateLabel(row.published_at))}</p>
          <a href="${esc(safeHttps(row.source_url))}" target="_blank" rel="noopener noreferrer">Open original listing ↗</a>
          ${row.review_note ? `<p class="entry-meta">Review note: ${esc(row.review_note)}</p>` : ""}
        </div>
        <div class="entry-actions">${row.status === "pending" ? `<button class="btn btn-primary" data-action="approve" data-id="${esc(row.id)}">Review & publish</button><button class="btn btn-danger" data-action="reject" data-id="${esc(row.id)}">Reject</button>` : ""}</div>
      </article>`).join("");
  }
  async function loadQueue() {
    if (busy) return; busy = true;
    try {
      const {data,error} = await db.from("noh_discovered_opportunities").select("id,source_name,source_url,title,summary,published_at,discovered_at,status,review_note").order("discovered_at",{ascending:false}).limit(500);
      if (error) throw error;
      currentRows = data || []; render(); await loadStats();
      notice(`Connected. ${currentRows.filter(x=>x.status === "pending").length} pending listings are waiting for administrator review.`);
    } catch (e) { notice(e.message || "Unable to load the discovery queue.",true); }
    finally { busy = false; }
  }
  function openApproval(id) {
    const row = currentRows.find(x => x.id === id); if (!row) return;
    $("discoveryId").value = row.id;
    $("title").value = row.title || "";
    $("organization").value = "";
    $("category").value = "Other";
    $("location").value = "Nigeria";
    $("deadline").value = "";
    $("applicationUrl").value = "";
    $("sourceUrl").value = safeHttps(row.source_url);
    $("description").value = row.summary || `Visit the official source for full details about ${row.title}. Confirm all requirements before publishing.`;
    $("eligibility").value = "";
    $("officialVerified").checked = false;
    $("sourceSummary").textContent = `Source: ${row.source_name}. The feed is a discovery lead, not proof of eligibility or an official application channel. Verify the organisation's own website before publishing.`;
    $("reviewDialog").showModal();
  }
  async function approve(event) {
    event.preventDefault(); if (busy) return;
    const id = $("discoveryId").value;
    if (!$("officialVerified").checked) { notice("Confirm the official-source checks before publishing.",true); return; }
    const applicationUrl = safeHttps($("applicationUrl").value.trim());
    const sourceUrl = safeHttps($("sourceUrl").value.trim());
    if (!applicationUrl || !sourceUrl) { notice("Both URLs must be valid HTTPS links.",true); return; }
    const deadline = $("deadline").value || null;
    if (deadline && deadline < new Date().toISOString().slice(0,10)) { notice("This deadline has passed. Do not publish it as an open opportunity.",true); return; }
    const row = {
      title:$("title").value.trim(), organization:$("organization").value.trim(), category:$("category").value,
      location:$("location").value.trim() || "Nigeria", description:$("description").value.trim(),
      eligibility:$("eligibility").value.trim() || null, application_url:applicationUrl, source_url:sourceUrl,
      deadline, status:"published", verified_at:new Date().toISOString(), updated_at:new Date().toISOString()
    };
    if (!row.title || !row.organization || !row.description) { notice("Complete the title, organisation and description.",true); return; }
    busy = true; $("publishBtn").disabled = true; $("publishBtn").textContent = "Publishing…";
    try {
      const {data:existing,error:findError} = await db.from("opportunities").select("id").ilike("title",row.title).limit(1);
      if (findError) throw findError;
      if (existing?.length) throw new Error("A published or existing opportunity already uses this title. Check the main opportunities table before proceeding.");
      const {data:inserted,error:insertError} = await db.from("opportunities").insert(row).select("id").single();
      if (insertError) throw insertError;
      const {data:{user}} = await db.auth.getUser();
      const {data:reviewed,error:updateError} = await db.from("noh_discovered_opportunities").update({status:"imported",imported_opportunity_id:inserted.id,reviewed_at:new Date().toISOString(),reviewed_by:user.id,review_note:"Official source, eligibility, deadline and application URL checked by administrator."}).eq("id",id).eq("status","pending").select("id").maybeSingle();
      if (updateError || !reviewed) {
        await db.from("opportunities").delete().eq("id",inserted.id);
        throw updateError || new Error("This discovery item is no longer pending. The new opportunity insert was rolled back.");
      }
      // Ask the existing image service to retrieve the listing's source-page image.
      db.functions.invoke("fetch-opportunity-image",{body:{id:inserted.id}}).catch(err=>console.warn("NOH image retrieval queued/failed:",err));
      $("reviewDialog").close(); notice("Opportunity approved and published. Image retrieval has been requested."); await loadQueue();
    } catch (e) { notice(e.message || "Unable to publish this opportunity.",true); }
    finally { busy = false; $("publishBtn").disabled = false; $("publishBtn").textContent = "Approve & publish"; }
  }
  async function reject(id) {
    const note = window.prompt("Why are you rejecting this discovery? (Optional)","Not suitable or could not be verified from an official source.");
    if (note === null) return;
    try {
      const {data:{user}} = await db.auth.getUser();
      const {error} = await db.from("noh_discovered_opportunities").update({status:"rejected",reviewed_at:new Date().toISOString(),reviewed_by:user.id,review_note:note.trim() || "Rejected by administrator."}).eq("id",id).eq("status","pending");
      if (error) throw error; notice("Discovery rejected."); await loadQueue();
    } catch (e) { notice(e.message || "Unable to reject this discovery.",true); }
  }
  async function init() {
    try {
      if (!window.supabase?.createClient) throw new Error("Supabase client did not load. Refresh this page.");
      db = window.supabase.createClient(SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY);
      await requireAdmin(); await loadQueue();
    } catch (e) { notice(e.message || "Administrator access required.",true); }
    $("refreshBtn").addEventListener("click",loadQueue);
    $("searchInput").addEventListener("input",render);
    $("statusFilter").addEventListener("change",render);
    $("queue").addEventListener("click",e=>{const b=e.target.closest("button[data-action]");if(!b)return;if(b.dataset.action==="approve")openApproval(b.dataset.id);if(b.dataset.action==="reject")reject(b.dataset.id);});
    $("approveForm").addEventListener("submit",approve);
    $("closeDialog").addEventListener("click",()=>$("reviewDialog").close());
    db?.auth.onAuthStateChange((_event)=>{ if(db) loadQueue(); });
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init);else init();
})();
