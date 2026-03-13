import * as FileSystem from "expo-file-system";
import { MobileVaultCore } from "./mobile-vault-core.js";
import { ensureMobileCryptoReady } from "./mobile-crypto.js";

const VAULT_DIRECTORY = "passwordmaneger";
const VAULT_FILENAME = "vault-envelope.json";

let localVaultCorePromise = null;

function getDocumentDirectory() {
    if (!FileSystem.documentDirectory) {
        throw new Error("端末ストレージを利用できません。");
    }
    return FileSystem.documentDirectory;
}

function getVaultDirectoryUri() {
    return `${getDocumentDirectory()}${VAULT_DIRECTORY}/`;
}

function getVaultFileUri() {
    return `${getVaultDirectoryUri()}${VAULT_FILENAME}`;
}

async function readEnvelopeFile() {
    const fileUri = getVaultFileUri();
    const info = await FileSystem.getInfoAsync(fileUri);
    if (!info.exists) {
        return null;
    }

    const raw = await FileSystem.readAsStringAsync(fileUri);
    return JSON.parse(raw);
}

async function writeEnvelopeFile(envelope) {
    const directoryUri = getVaultDirectoryUri();
    await FileSystem.makeDirectoryAsync(directoryUri, { intermediates: true });
    await FileSystem.writeAsStringAsync(getVaultFileUri(), JSON.stringify(envelope, null, 2));
}

export async function getLocalVaultCore() {
    ensureMobileCryptoReady();

    if (!localVaultCorePromise) {
        localVaultCorePromise = Promise.resolve(
            new MobileVaultCore({
                readEnvelope: readEnvelopeFile,
                writeEnvelope: writeEnvelopeFile
            })
        );
    }

    return localVaultCorePromise;
}

export async function callLocalApi(action, payload = {}) {
    const core = await getLocalVaultCore();
    return core.handleAction({ action, ...payload });
}
