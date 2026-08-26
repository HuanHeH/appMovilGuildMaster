// This file is web-only and used to configure the root HTML for every
// web page during static rendering.
// The contents of this function only run in Node.js environments and
// do not have access to the DOM or browser APIs.
export default function Root({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" style={{ colorScheme: 'dark' }}>
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />

        {/* Keep browser zoom enabled for accessibility on desktop and mobile web. */}
        <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
        <meta name="color-scheme" content="dark only" />
        <meta name="theme-color" content="#000000" />

        {/* Using raw CSS styles as an escape-hatch to ensure the background color never flickers in dark-mode. */}
        <style dangerouslySetInnerHTML={{ __html: responsiveBackground }} />
        {/* Add any additional <head> elements that you want globally available on web... */}
      </head>
      <body>{children}</body>
    </html>
  );
}

const responsiveBackground = `
:root { color-scheme: dark only; }
html, body, #root {
  height: 100%;
  max-height: 100%;
  margin: 0;
  padding: 0;
  overflow: hidden;
  background-color: #000000;
  color: #ffffff;
}
body {
  background-color: #000000;
  overscroll-behavior: none;
}
#root {
  display: flex;
  flex-direction: column;
  background-color: #000000;
}
#root > div {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  background-color: #000000;
}
`;
