import { ServerRequest } from "https://deno.land/std@v0.41.0/http/mod.ts";
import { MultipartReader, FormFile } from "https://deno.land/std@v0.41.0/mime/mod.ts";
import { hmac } from "https://denopkg.com/chiefbiiko/hmac/mod.ts";
import { SIGNATURE_SECRET, WORKER_PATH } from "../config/config.ts";

const boundaryRegex = /boundary=([^\s]+)/
const maxFormMemory = 1024 * 1024
const attachedFileKey = 'code'
const archiveBaseDir = '/tmp/archive'
const workerFnFileName = 'worker-fn.ts'

async function getAttachment(req: ServerRequest): Promise<FormFile> {
    if (req == null) {
        throw new Error('req is null');  
    }
    if (req.headers == null) {
        throw new Error('req.headers is null'); 
    }

    const contentType = req.headers.get("content-type");

    if (contentType == null) { 
        throw new Error('content-type header value is null');
    }

    const boundaries = contentType.match(boundaryRegex);
    
    if (boundaries == null) {
        throw new Error('boundaries are null');
    }

    const boundary = boundaries[1];
    const reader = new MultipartReader(req.body,boundary);
    const form = await reader.readForm(maxFormMemory);
    return form.file(attachedFileKey) as FormFile;
}

function getReadyForBundling(attachment: FormFile): string {
    const date = Date.now() / 1000;
    const workersAssemblyPath = Deno.makeTempDirSync({ 
        prefix: `bundle_${date}_`,
        dir: archiveBaseDir
    });
    const archieveFilePath = `${workersAssemblyPath}/output.tar`;
    const content: Uint8Array = attachment.content as Uint8Array;
    Deno.writeFileSync(archieveFilePath, content);

    Deno.run({
        cmd: ["tar", "-xf", archieveFilePath, "--directory", workersAssemblyPath]
      });
    
    const decoder = new TextDecoder("utf-8");
    const encoder = new TextEncoder();
    const data = Deno.readFileSync(`templates/workers/${workerFnFileName}`);
    let fileContents = decoder.decode(data)
    fileContents = fileContents.replace("path_to_entrypoint", `${WORKER_PATH}`);
    Deno.writeFileSync(`${workersAssemblyPath}/${workerFnFileName}`, encoder.encode(fileContents));

    return workersAssemblyPath
}

function compileJsonResponseString(base64CustomerWorker: string, signedCode: string | Uint8Array): string {
    return JSON.stringify({
        created_at: new Date(),
        input_type: "javascript",
        output_type: "javascript",
        compiled_code: base64CustomerWorker,
        signature: signedCode
    });
}

export default async function compileHandler(req: ServerRequest): Promise<void> {
    try {
        const attachment: FormFile = await getAttachment(req)
        if (typeof(attachment) != 'object') {
            console.error("attachment is not an object");
            req.respond({
                status: 400,
                body: "attached file should be an object"
            });
        }

        if (attachment.content) {
            const workersAssemblyPath = getReadyForBundling(attachment)

            // bundle function
            let [diagnostics, emit] = await Deno.bundle(`${workersAssemblyPath}/main.js`);
            if (diagnostics !== null) {
                throw `diagnostics is not null`;
            }

            const encoder = new TextEncoder();
            // bundle customerWorker
            Deno.writeFileSync(`${workersAssemblyPath}/customerFn.js`, encoder.encode(emit));
            [diagnostics, emit] = await Deno.bundle(`${workersAssemblyPath}/${workerFnFileName}`);

            const base64CustomerWorker = btoa(emit);
            const signedCode = hmac('sha1', SIGNATURE_SECRET, base64CustomerWorker, 'base64', 'hex');

            // cleanup
            Deno.remove(workersAssemblyPath, {recursive: true});

            const response = compileJsonResponseString(base64CustomerWorker, signedCode);
            const headersMap = new Headers();
            headersMap.set('Content-Type', 'application/json');
            req.respond({
                status: 200,
                headers: headersMap,
                body: response,
            });

        } else if (attachment.tempfile) {
            req.respond({
                status: 500,
                body: `attachement file size is greater than ${maxFormMemory}`
            });
        }
    } catch (e) {
        console.error(e.message);
        console.error(e.stack);
        req.respond({
            status: 500,
            body: `failed to process attached file, err: ${e.message}`
        });
    }
    return undefined;
}