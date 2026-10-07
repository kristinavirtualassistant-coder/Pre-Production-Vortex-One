import dns from 'node:dns/promises';
import net from 'node:net';

function isPrivateIp(address:string):boolean {
  const family=net.isIP(address);
  if(family===4){ const [a,b]=address.split('.').map(Number); return a===10 || a===127 || (a===169&&b===254) || a===0 || (a===172&&b>=16&&b<=31) || (a===192&&b===168) || (a===100&&b>=64&&b<=127); }
  if(family===6){ const normalized=address.toLowerCase(); return normalized==='::1' || normalized==='::' || normalized.startsWith('fc') || normalized.startsWith('fd') || normalized.startsWith('fe80:'); }
  return true;
}

export async function validateWebhookTarget(rawUrl:string, allowlist:string[]):Promise<URL>{
  let url:URL; try{url=new URL(rawUrl);}catch{throw new Error('Invalid webhook URL');}
  if(url.protocol!=='https:' || url.username || url.password) throw new Error('Webhook URL must be HTTPS without credentials');
  const host=url.hostname.toLowerCase();
  if(!allowlist.includes(host)) throw new Error('Webhook host is not allowlisted');
  if(net.isIP(host) && isPrivateIp(host)) throw new Error('Webhook target resolves to a private or reserved IP');
  const records=await dns.lookup(host,{all:true,verbatim:true});
  if(!records.length || records.some(record=>isPrivateIp(record.address))) throw new Error('Webhook target resolves to a private or reserved IP');
  return url;
}
