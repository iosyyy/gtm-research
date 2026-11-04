import {readFile,writeFile} from 'node:fs/promises';
const base = new URL('./',import.meta.url);
const plan = (await readFile(new URL('plan.js',base),'utf8')).replaceAll('export function ','function ');
const template = await readFile(new URL('client.template.js',base),'utf8');
const custom = (await readFile(new URL('custom-skills.js',base),'utf8')).replaceAll('export function ','function ');
const styles = await readFile(new URL('studio.css',base),'utf8');
const skills = await readFile(new URL('skills.json',base),'utf8');
const catalog = await readFile(new URL('templates.json',base),'utf8');
await writeFile(new URL('client.js',base),template.replace('/* PLAN_IMPLEMENTATION */',plan).replace('/* CUSTOM_SKILLS */',custom).replace('/* TEMPLATE_CATALOG */',catalog).replace('/* STUDIO_STYLES */',JSON.stringify(styles)).replace('/* SKILL_CATALOG */',skills));
