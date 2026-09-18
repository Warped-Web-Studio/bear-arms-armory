# Store photographs

The existing `settings.business` JSONB column now supports an optional ordered
`storePhotos` array of `{ url, description }` objects. Array order is display
order. The server validates every URL and description and permits up to 20 photos.
No new database table, column, SQL migration, dependency, or environment variable
is required.

## Existing data and deployment

1. Run `npm test`, `npm run lint`, `npm run typecheck`, and `npm run build`.
   If Turbopack cannot bind its internal port in a restricted environment,
   `npm run build -- --webpack` is the available build-verification alternative.
2. Deploy the application through the normal deployment process. There is no
   migration command to run for this change. Keep the existing database,
   authentication, image-host and Cloudinary environment settings.
3. Refresh any open admin forms after deployment before editing or saving.
4. Open Business information. An existing single photo and its description appear
   automatically as the first photograph. No re-upload or initial save is needed
   for it to appear publicly.
5. The next business-information save persists the explicit ordered array. The
   old `storeImageUrl` and `storeImageAlt` keys remain intact for compatibility.
   The new array is authoritative whenever present, including `[]`. Removing all
   photos therefore does not resurrect the legacy photo. Rolling back to the old
   application would display its legacy single-photo values rather than gallery
   edits made after this deployment; preserve the JSONB data when rolling back.

Uploads use the same authenticated, size-limited, file-signature-checked
Cloudinary flow as before. Photo removal is a draft form change until Save; it
removes the gallery reference, not the Cloudinary asset. Reloading before Save
restores the saved gallery. Failed saves retain the edited gallery for retry.

## Public behavior

Our Store keeps its heading above the photo/text layout. Photos appear left and
paragraphs right above 720px, with their tops aligned; at 720px and below, the
heading, photos, and paragraphs stack in that order. With no photographs, only
the text appears. The transparent photo area has a stable 3:2 shape and 420px
maximum height. `object-fit: contain` shows the full portrait, square, or landscape
photo without distortion or the former green frame. Background space is the
ordinary page background. Changing slides does not resize the frame.

One photo has no controls or timer. Multiple photos advance every six seconds,
with wrapping Previous/Next overlay buttons and a position indicator. There is
no dedicated Pause/Play button. On fine-pointer hover devices the arrows fade in
on hover or keyboard focus; touch-device arrows remain visible.
Hover, keyboard focus inside the carousel, and a hidden browser tab pause the
timer. Leaving those states or navigating manually starts a fresh interval.
Reduced motion disables automatic advancement; manual buttons still work and
transitions are immediate. Normally, the current image remains visible while
the next image loads, then the two crossfade over 900ms. At most two images are
mounted: the current lazy-loaded image and an incoming optimized image requested
when navigation begins. Both layers overlap for the entire fade, and the decoded
incoming image element is retained after the transition. Failed image requests retain the current photo and
show a retry message.

## Final manual verification

At 375, 430, 768, 1024, and 1440px, inspect the public section and admin form:

- No photos, a single photo, and multiple photos; original copy remains present.
- Portrait, square and very wide photos show all edges without stretching.
- Photos are above text on mobile and left of text on wider layouts; no overflow.
- Next/Previous wrap; hover reveals overlay arrows; focus remains visible and keyboard Enter
  and Space activate the native buttons. Focus and hover pause autoplay.
- Reduced-motion preference disables autoplay; changing it updates behavior.
- Existing photo survives deployment; upload, replace, reorder, remove, Save,
  reload, and confirm descriptions/order. Removing all photos hides the carousel.
- Confirm live Cloudinary uploads and database saves in the deployed environment.

Automated tests mock external uploads/database access; they do not upload client
photos or write production settings. Browser visual checks are a separate final
acceptance step.

## Reordering diagnosis

Reordering edits local React state; it never submits the form or makes a server
request. Only Save persists the ordered array. Previously, moving a photo to a
boundary disabled the same focused button, and the global disabled-button rule
showed a wait cursor even though no operation was pending. Unavailable boundary controls are now omitted: the first photo has no Move earlier
button and the last photo has no Move later button. Moves resolve the photo by
its stable local key and guard both boundaries. Tests verify no action is sent
by a move, valid moves in both directions work, and upload/save failures recover. An actual
unresolved server request was not reproduced by those tests.
