Naija Opportunity Hub — Firefox opportunity-card fix

Package contents
- noh-firefox-image-fix.css: targeted CSS override for the category listing cards.

What it corrects
- Gives the thumbnail and text separate grid columns so Firefox cannot squeeze
  the title into a very narrow flex item.
- Makes each opportunity image fill the complete thumbnail area using
  object-fit: cover (instead of contain, which caused the green bands/empty
  space visible in the screenshot).
- Keeps the Save control clear of the title text.
- Includes a narrow-screen adjustment.

Installation
1. Upload noh-firefox-image-fix.css to the website root (same level as category.html).
2. In category.html, add this line AFTER the existing inline style blocks in <head>:
   <link rel="stylesheet" href="/noh-firefox-image-fix.css?v=1">
3. Purge the relevant Cloudflare cache or hard-refresh the page.
4. Check the Jobs page in Firefox and Chrome.

Important
- This is a targeted CSS patch, not a full website backup.
- It does not change Supabase data, opportunity image URLs, bookmarks, tracker,
  authentication, or Career Kit.
- object-fit: cover fills the thumbnail but may crop the outer edges of images
  whose aspect ratio differs from the square thumbnail.
