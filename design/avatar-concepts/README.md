# Storybook Watercolor Student Avatars

Built-in ImageGen was used for the approved concept sheets and production watercolor layer atlases. No runtime image-generation service or paid API is used by the web app.

## Prompt Set

- Concepts: diverse human secondary-school students in authentic storybook watercolor; four face shapes, natural fair-to-deep skin tones, interchangeable hair and accessories; twelve school, casual, sport and creative outfits. White paper, no labels or logos.
- Face atlas: four front-facing bald heads with necks, consistent proportions and warm tan source pigment, 2x2 transparent tiles; no clothing or accessories.
- Hair atlas: eight front-facing watercolor wigs with transparent face openings, 4x2 transparent tiles; textured short, side part, bob, straight long, wavy, curly, ponytail and low bun.
- Outfit atlas: twelve empty front-facing watercolor shirt/upper-body overlays, 4x3 transparent tiles; white school shirt, ribbon blouse, sports polo, tracksuit, hoodie, cardigan, striped tee, denim jacket, sweatshirt, pinafore, art apron and blue overshirt.
- Accessory atlas: round glasses, rectangular glasses, yellow clip and green headband, 2x2 transparent tiles; no faces, transparent lenses.

`scripts/prepare-avatar-assets.mjs` slices the generated atlases, normalizes transparent bounds, and writes optimized WebP layers to `public/avatars/watercolor-v1`. It accepts the local generated-image directory as its argument. Generated source filenames are recorded in that script. Original concept sheets are retained here, outside the deployed asset directory.

The browser composes raster layers onto a canvas and recolors skin/hair pigment while preserving luminance texture. Layer positions are calibrated in `src/avatar/render.ts`. These are head-and-torso avatars, not full-body outfits. Skin, face, hair, clothing and accessory selections are independent; all options are unlocked.

User preferences are stored separately from growth, behavior and grades in `student_avatar_customizations`. The legacy `student_id` column is an owner profile ID and now supports both teachers and students; it is retained to preserve existing saved student avatars. Apply `supabase/avatar-teacher-access.sql` to an existing installation. Everyone can edit only their own avatar; classroom teachers retain read-only access to student avatars. Rendering does not infer emotion, behavior or gender. Permissions are tested in `tests/avatar-rls.sql`; that test rolls back every write.
