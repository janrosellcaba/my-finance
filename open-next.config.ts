import { defineCloudflareConfig } from "@opennextjs/cloudflare";

const config = defineCloudflareConfig({
	// Uncomment to enable R2 cache,
	// It should be imported as:
	// `import r2IncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/r2-incremental-cache";`
	// See https://opennext.js.org/cloudflare/caching for more details
	// incrementalCache: r2IncrementalCache,
});

// defineCloudflareConfig() doesn't forward arbitrary keys, so buildCommand must be set on its
// return value directly. Without it, `opennextjs-cloudflare build` shells out to `npm run build`
// to compile the Next.js app — but our "build" script IS `opennextjs-cloudflare build`, so it
// would call itself forever.
config.buildCommand = "next build";

export default config;
