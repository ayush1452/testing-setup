export const dynamic = "force-dynamic";

function clamp(value: number, minimum: number, maximum: number) {
  if (!Number.isFinite(value)) {
    return minimum;
  }

  return Math.min(maximum, Math.max(minimum, value));
}

function sleep(durationMs: number) {
  return new Promise((resolve) => setTimeout(resolve, durationMs));
}

function imageSvg(theme: string) {
  const tint = theme === "teal" ? "#177c80" : "#f2643b";
  const accent = theme === "teal" ? "#f2643b" : "#177c80";

  return `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1400 920" role="img" aria-labelledby="title desc">
      <title id="title">Faro Observatory Web Vitals Poster</title>
      <desc id="desc">A synthetic hero image used to create a visible largest-contentful-paint candidate.</desc>
      <defs>
        <linearGradient id="wash" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#fff9ef" />
          <stop offset="100%" stop-color="#efe6d8" />
        </linearGradient>
        <radialGradient id="pulse" cx="80%" cy="12%" r="60%">
          <stop offset="0%" stop-color="${tint}" stop-opacity="0.35" />
          <stop offset="100%" stop-color="${tint}" stop-opacity="0" />
        </radialGradient>
      </defs>
      <rect width="1400" height="920" fill="url(#wash)" />
      <rect width="1400" height="920" fill="url(#pulse)" />
      <circle cx="1180" cy="182" r="148" fill="${accent}" fill-opacity="0.18" />
      <circle cx="196" cy="742" r="204" fill="${tint}" fill-opacity="0.16" />
      <rect x="82" y="76" width="1236" height="768" rx="44" fill="white" fill-opacity="0.54" stroke="#14253d" stroke-opacity="0.12" />
      <text x="132" y="198" fill="#617287" font-size="28" font-family="Avenir Next, Helvetica Neue, sans-serif" letter-spacing="5">WEB VITALS PROBE</text>
      <text x="132" y="338" fill="#14253d" font-size="120" font-family="Avenir Next, Helvetica Neue, sans-serif" font-weight="700">Largest</text>
      <text x="132" y="448" fill="#14253d" font-size="120" font-family="Avenir Next, Helvetica Neue, sans-serif" font-weight="700">Contentful</text>
      <text x="132" y="558" fill="#14253d" font-size="120" font-family="Avenir Next, Helvetica Neue, sans-serif" font-weight="700">Paint</text>
      <text x="132" y="646" fill="#617287" font-size="34" font-family="Avenir Next, Helvetica Neue, sans-serif">Delayed image response to surface a clean LCP candidate in Faro and Next.js.</text>
      <rect x="132" y="714" width="228" height="58" rx="29" fill="${tint}" />
      <text x="184" y="752" fill="#fff7ef" font-size="28" font-family="Avenir Next, Helvetica Neue, sans-serif">Observe LCP</text>
    </svg>
  `.trim();
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const delayMs = clamp(Number(url.searchParams.get("delay") ?? 900), 0, 2200);
  const theme = url.searchParams.get("theme") === "teal" ? "teal" : "accent";

  try {
    await sleep(delayMs);

    return new Response(imageSvg(theme), {
      headers: {
        "Cache-Control": "no-store",
        "Content-Type": "image/svg+xml; charset=utf-8",
        "Server-Timing": `vital-image;dur=${delayMs}`,
        "Timing-Allow-Origin": "*",
      },
    });
  } catch {
    return new Response("image generation failed", {
      status: 500,
    });
  }
}
