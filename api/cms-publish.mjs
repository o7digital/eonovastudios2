import { timingSafeEqual } from 'node:crypto';

const projectId = 'prj_bSppuywI4jwUlMZjBdHOwQ0b394s';
const teamId = 'team_us0QXK8b92R7QUjYXLrWUHGn';
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ error:'Method not allowed' }); }
  const secret = process.env.CMS_PUBLISH_SECRET;
  const token = process.env.VERCEL_DEPLOY_TOKEN;
  if (!secret || !token) return res.status(503).json({ error:'Publishing is not configured' });
  const expected = Buffer.from(`Bearer ${secret}`);
  const supplied = Buffer.from(String(req.headers.authorization ?? ''));
  if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) return res.status(401).json({ error:'Unauthorized' });
  try {
    const endpoint = new URL('https://api.vercel.com/v6/deployments');
    endpoint.search = new URLSearchParams({projectId,teamId,limit:'5',target:'production'}).toString();
    const headers = {Authorization:`Bearer ${token}`,'Content-Type':'application/json'};
    const current = await fetch(endpoint,{headers,signal:AbortSignal.timeout(20000)});
    if (!current.ok) throw new Error('Cannot check deployment status');
    const {deployments} = await current.json();
    if (deployments.some(deployment => ['QUEUED','INITIALIZING','BUILDING'].includes(deployment.readyState ?? deployment.state))) return res.status(202).json({message:'Publication already in progress'});
    const latest = deployments[0];
    if (latest && Date.now() - latest.created < 90000) return res.status(429).json({error:'Wait 90 seconds between publications'});
    const response = await fetch(`https://api.vercel.com/v13/deployments?teamId=${teamId}`, {
      method:'POST',headers,signal:AbortSignal.timeout(20000),
      body:JSON.stringify({name:'eon2',project:projectId,target:'production',gitSource:{type:'github',repoId:1163450315,ref:'dev'},meta:{source:'eon-directus'}}),
    });
    if (!response.ok) throw new Error('Deployment request failed');
    const deployment = await response.json();
    return res.status(202).json({message:'Publication started. Wait for the successful build.',id:deployment.id});
  } catch {
    return res.status(502).json({error:'Publication could not start. The current website is unchanged.'});
  }
}
