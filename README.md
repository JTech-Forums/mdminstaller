

### TODO

* Redesign **Install / View Info** button to look more standard and polished
* Normalize **container sizes** so everything matches nicely
* Expand **ADB console black screen** to fill unused space
* Investigate and fix **ADB vendor key expiration** (why they renew every time the page reloads or loses focus)
* Rewrite **tutorial** to be larger, clearer, and more “for dummies” friendly
* Add **JTech metadata and logo** integration
* Improve **MDM install log page** — bigger layout, more useful info
* Smooth out **USB device detection** for a seamless experience
* Update overall **color scheme** → switch from purple to blue
* Add a **Privacy Policy** page with acceptance checkbox
* Display **install counts per filter** directly on each MDM card
* Add a **Sign Up** button to encourage joining JTech Forums
* Add a **Contact Us** option (simple: email you or FlipAdmin)
* Implement a **cursor trail / smoke effect** for flair

### Run
`npm install`
`npm run dev`

No html opening please...

### Build and Deploy to GitHub Pages

To publish a static version of the installer:

1. Build the site into the `docs/` directory:

   ```
   npm run build
   ```

2. Commit the generated `docs/` folder and push to GitHub.
3. In your repository settings, enable GitHub Pages from the **main** branch using the `/docs` folder.
4. For a custom domain, keep the `CNAME` file and configure Cloudflare with a CNAME record pointing `installer.jtechforums.org` to your GitHub Pages domain.
