import {robotsText} from '../lib/seo.mjs';
export function GET() {
  return new Response(robotsText(), {headers:{'Content-Type':'text/plain; charset=utf-8'}});
}
