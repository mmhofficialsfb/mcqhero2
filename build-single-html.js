import fs from 'fs';
import path from 'path';

function bundleSingleHtml() {
  try {
    const distPath = path.join(process.cwd(), 'dist');
    if (!fs.existsSync(distPath)) {
      console.error("Error: Please run 'npm run build' first to generate the compilation folder!");
      process.exit(1);
    }

    let html = fs.readFileSync(path.join(distPath, 'index.html'), 'utf8');
    const assetsPath = path.join(distPath, 'assets');

    // Find JS and CSS assets
    if (fs.existsSync(assetsPath)) {
      const files = fs.readdirSync(assetsPath);
      let jsFiles = files.filter(f => f.endsWith('.js'));
      let cssFiles = files.filter(f => f.endsWith('.css'));

      console.log('Detected compiled bundle assets:', files);

      // 1. Process CSS files
      cssFiles.forEach(cssFile => {
        const cssContent = fs.readFileSync(path.join(assetsPath, cssFile), 'utf8');
        // Find stylesheet links and replace with embedded <style>
        const styleTag = `<style>${cssContent}</style>`;
        // Find links
        const regex = new RegExp(`<link[^>]*href="[^"]*${cssFile}"[^>]*>`, 'g');
        if (regex.test(html)) {
          html = html.replace(regex, styleTag);
        } else {
          // Fallback, append to head
          html = html.replace('</head>', `${styleTag}</head>`);
        }
      });

      // 2. Process JS files
      jsFiles.forEach(jsFile => {
        const jsContent = fs.readFileSync(path.join(assetsPath, jsFile), 'utf8');
        // Find script tag with this src and replace with embedded script
        const scriptTag = `<script type="module">${jsContent}</script>`;
        const regex = new RegExp(`<script[^>]*src="[^"]*${jsFile}"[^>]*></script>`, 'g');
        if (regex.test(html)) {
          html = html.replace(regex, scriptTag);
        } else {
          // Fallback, append to body
          html = html.replace('</body>', `${scriptTag}</body>`);
        }
      });

      // 3. Simple cleanup of relative path references that can break single HTML files
      html = html.replace(/href="\/assets\//g, 'href="assets/');
      html = html.replace(/src="\/assets\//g, 'src="assets/');

      const outputPath = path.join(process.cwd(), 'hobweb-single-file-app.html');
      fs.writeFileSync(outputPath, html, 'utf8');
      console.log(`\n======================================================`);
      console.log(`🎉 SUCCESS: 100% self-contained HTML file created!`);
      console.log(`📍 File path: ${outputPath}`);
      console.log(`💡 You can copy this file directly to Hobweb on your mobile phone!`);
      console.log(`======================================================\n`);
    } else {
      console.error("Error: No compile assets found in dist/assets");
    }
  } catch (error) {
    console.error("Failed to bundle single HTML:", error);
  }
}

bundleSingleHtml();
