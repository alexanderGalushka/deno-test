import { serve } from "https://deno.land/std@v0.41.0/http/mod.ts";
  
const s = serve({ port: 8080});
console.log(`listening on 8080`);

for await (const req of s) {

    const date = new Date() 
    const now = date.toISOString();
    console.log(`${now} ${req.method} ${req.url}`);
      
    if (req.url === "/health") {
        req.respond({
        status: 200,
        body: "ok"
        });
    } else {
        req.respond({
            status: 406,
            body: "not supported"
        });
    }
}