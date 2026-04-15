import { net, protocol, type Session } from "electron";
import path from "node:path";
import { pathToFileURL } from "node:url";

const APP_SCHEME = "app";
const APP_HOST = "-";

protocol.registerSchemesAsPrivileged([
  {
    scheme: APP_SCHEME,
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      stream: true,
      corsEnabled: true,
    },
  },
]);

function resolveAssetPath(rootDir: string, requestPath: string) {
  const decodedPath = decodeURIComponent(requestPath);
  const normalizedPath = path.posix.normalize(decodedPath);
  const relativePath =
    normalizedPath === "/" || normalizedPath === "."
      ? "index.html"
      : normalizedPath.replace(/^\/+/, "");
  const candidatePath = path.resolve(rootDir, relativePath);

  if (!candidatePath.startsWith(rootDir)) {
    return null;
  }

  if (!path.extname(relativePath)) {
    return path.join(rootDir, "index.html");
  }

  return candidatePath;
}

export async function registerAppProtocol(rootDir: string, targetSession?: Session) {
  const sessionProtocol = targetSession?.protocol ?? protocol;
  await sessionProtocol.handle(APP_SCHEME, (request) => {
    const requestUrl = new URL(request.url);
    const assetPath = resolveAssetPath(rootDir, requestUrl.pathname);

    if (!assetPath) {
      return new Response("Not found.", { status: 404 });
    }

    return net.fetch(pathToFileURL(assetPath).toString());
  });
}

export function getAppUrl() {
  return `${APP_SCHEME}://${APP_HOST}/`;
}
