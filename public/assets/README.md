# RCLD brand assets

Upload the official institute logo into this folder.

## Primary logo file
- Keep the official logo at: `public/assets/rcld-logo.svg`
- The app serves it at: `/assets/rcld-logo.svg`
- The shared component is: `components/RCLDLogo.js`

The ERP sidebar, ERP login screen and printable student registration form use this shared component. Other screens should import the same component instead of creating text-only logo marks.

When replacing the temporary logo, keep the filename unchanged. If the official artwork is PNG instead, update the shared component's image path once; do not change every screen separately.

Recommended: transparent background, original proportions, high-resolution artwork, no extra whitespace.
