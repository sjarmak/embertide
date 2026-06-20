#!/usr/bin/env node
// Deploy guard (MH-12 / IP safety): Realm Ascension is a local-household
// project. It must never be built inside a hosted deploy environment.
// If this script detects hosted-deploy signals, it aborts the build.

const hostedSignals = [
  ['VERCEL', process.env.VERCEL],
  ['NETLIFY', process.env.NETLIFY],
];

const tripped = hostedSignals.filter(([, value]) => Boolean(value));

if (tripped.length > 0) {
  const names = tripped.map(([name]) => name).join(', ');
  console.error(
    `Realm Ascension is local-household only — deployment refused. ` +
      `Detected hosted-deploy signal(s): ${names}.`,
  );
  process.exit(1);
}

process.exit(0);
