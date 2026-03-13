const fs = require("node:fs/promises");
const path = require("node:path");
const {
    createRunOncePlugin,
    withAndroidManifest,
    withDangerousMod,
    withEntitlementsPlist,
    withXcodeProject,
    IOSConfig,
} = require("@expo/config-plugins");

const PLUGIN_NAME = "with-passwordmaneger-native-autofill";
const PLUGIN_VERSION = "1.1.0";
const DEFAULT_IOS_EXTENSION_NAME = "PasswordManegerAutofillExtension";
const DEFAULT_ANDROID_SERVICE_NAME = "PasswordManegerAutofillService";
const DEFAULT_ANDROID_SETTINGS_ACTIVITY = "PasswordManegerAutofillSettingsActivity";
const AUTOFILL_DIRECTORY = "passwordmaneger";
const AUTOFILL_CACHE_FILENAME = "autofill-cache.json";

function ensureArray(value) {
    return Array.isArray(value) ? value : value ? [value] : [];
}

async function writeFileIfChanged(filePath, content) {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    const next = String(content);
    try {
        const current = await fs.readFile(filePath, "utf8");
        if (current === next) {
            return;
        }
    } catch {
        // file does not exist yet
    }
    await fs.writeFile(filePath, next, "utf8");
}

function toJavaPackagePath(packageName) {
    return String(packageName || "").split(".").filter(Boolean).join(path.sep);
}

async function findIosAppDelegatePath(platformProjectRoot) {
    const entries = await fs.readdir(platformProjectRoot, { withFileTypes: true });

    for (const entry of entries) {
        if (!entry.isDirectory()) {
            continue;
        }

        for (const filename of ["AppDelegate.mm", "AppDelegate.m"]) {
            const candidate = path.join(platformProjectRoot, entry.name, filename);
            try {
                await fs.access(candidate);
                return candidate;
            } catch {
                // keep searching
            }
        }
    }

    throw new Error(`AppDelegate file not found under ${platformProjectRoot}`);
}

function getOptions(config, props = {}) {
    const androidPackage = props.androidPackage || config.android?.package;
    const iosBundleIdentifier = props.iosBundleIdentifier || config.ios?.bundleIdentifier;

    if (!androidPackage) {
        throw new Error(`${PLUGIN_NAME}: android.package is required.`);
    }
    if (!iosBundleIdentifier) {
        throw new Error(`${PLUGIN_NAME}: ios.bundleIdentifier is required.`);
    }

    const appGroup = props.appGroup || `group.${iosBundleIdentifier}`;
    const iosExtensionName = props.iosExtensionName || DEFAULT_IOS_EXTENSION_NAME;
    const iosExtensionBundleIdentifier = props.iosExtensionBundleIdentifier || `${iosBundleIdentifier}.autofill`;
    const androidAutofillPackage = `${androidPackage}.autofill`;
    const androidServiceClass = `${androidAutofillPackage}.${props.androidServiceName || DEFAULT_ANDROID_SERVICE_NAME}`;
    const androidSettingsActivityClass = `${androidAutofillPackage}.${props.androidSettingsActivityName || DEFAULT_ANDROID_SETTINGS_ACTIVITY}`;

    return {
        androidPackage,
        androidAutofillPackage,
        androidServiceClass,
        androidSettingsActivityClass,
        androidServiceName: props.androidServiceName || DEFAULT_ANDROID_SERVICE_NAME,
        androidSettingsActivityName: props.androidSettingsActivityName || DEFAULT_ANDROID_SETTINGS_ACTIVITY,
        androidAutofillXmlName: props.androidAutofillXmlName || "passwordmaneger_autofill_service",
        iosBundleIdentifier,
        iosExtensionName,
        iosExtensionBundleIdentifier,
        iosExtensionEntitlementsFile: `${iosExtensionName}/${iosExtensionName}.entitlements`,
        iosExtensionInfoPlistFile: `${iosExtensionName}/Info.plist`,
        iosExtensionSourceFile: `${iosExtensionName}/CredentialProviderViewController.swift`,
        appGroup,
    };
}

function findTargetEntry(project, targetName) {
    return Object.entries(project.pbxNativeTargetSection()).find(
        ([key, value]) => !key.endsWith("_comment") && value && value.name === `"${targetName}"`
    ) || null;
}

function mergeMainAppGroup(entitlements, appGroup) {
    const groups = new Set(ensureArray(entitlements["com.apple.security.application-groups"]));
    groups.add(appGroup);
    entitlements["com.apple.security.application-groups"] = [...groups];
    return entitlements;
}

function ensureAndroidServiceEntry(application, options) {
    const serviceList = ensureArray(application.service);
    const existing = serviceList.find((entry) => entry?.$?.["android:name"] === options.androidServiceClass);

    if (!existing) {
        serviceList.push({
            $: {
                "android:name": options.androidServiceClass,
                "android:label": "PasswordManeger AutoFill",
                "android:permission": "android.permission.BIND_AUTOFILL_SERVICE",
                "android:exported": "true",
            },
            "intent-filter": [
                {
                    action: [
                        {
                            $: {
                                "android:name": "android.service.autofill.AutofillService",
                            },
                        },
                    ],
                },
            ],
            "meta-data": [
                {
                    $: {
                        "android:name": "android.autofill",
                        "android:resource": `@xml/${options.androidAutofillXmlName}`,
                    },
                },
            ],
        });
    }

    application.service = serviceList;
}

function ensureAndroidSettingsActivity(application, options) {
    const activityList = ensureArray(application.activity);
    const existing = activityList.find((entry) => entry?.$?.["android:name"] === options.androidSettingsActivityClass);

    if (!existing) {
        activityList.push({
            $: {
                "android:name": options.androidSettingsActivityClass,
                "android:exported": "true",
                "android:label": "PasswordManeger AutoFill",
                "android:theme": "@android:style/Theme.Translucent.NoTitleBar",
            },
        });
    }

    application.activity = activityList;
}

function createAndroidAutofillXml(options) {
    return `<?xml version="1.0" encoding="utf-8"?>
<autofill-service xmlns:android="http://schemas.android.com/apk/res/android"
    android:settingsActivity="${options.androidSettingsActivityClass}" />
`;
}

function createAndroidAutofillServiceSource(options) {
    return `package ${options.androidAutofillPackage}

import android.app.assist.AssistStructure
import android.os.Build
import android.os.CancellationSignal
import android.service.autofill.AutofillService
import android.service.autofill.Dataset
import android.service.autofill.FillCallback
import android.service.autofill.FillRequest
import android.service.autofill.FillResponse
import android.service.autofill.SaveCallback
import android.service.autofill.SaveRequest
import android.text.InputType
import android.util.Log
import android.view.autofill.AutofillId
import android.view.autofill.AutofillValue
import android.widget.RemoteViews
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.util.Locale

private const val TAG = "PMAutofillService"
private const val AUTOFILL_DIRECTORY = "${AUTOFILL_DIRECTORY}"
private const val AUTOFILL_CACHE_FILENAME = "${AUTOFILL_CACHE_FILENAME}"

data class CredentialRecord(
    val id: String,
    val title: String,
    val username: String,
    val password: String,
    val url: String,
    val domain: String
)

data class ParsedFields(
    var usernameId: AutofillId? = null,
    var passwordId: AutofillId? = null,
    var webDomain: String = ""
)

class ${options.androidServiceName} : AutofillService() {
    override fun onFillRequest(
        request: FillRequest,
        cancellationSignal: CancellationSignal,
        callback: FillCallback
    ) {
        try {
            if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
                callback.onSuccess(null)
                return
            }

            val latestContext = request.fillContexts.lastOrNull()
            val structure = latestContext?.structure
            if (structure == null) {
                callback.onSuccess(null)
                return
            }

            val parsed = ParsedFields()
            for (index in 0 until structure.windowNodeCount) {
                val windowNode = structure.getWindowNodeAt(index)
                traverseNode(windowNode.rootViewNode, parsed)
            }

            if (parsed.usernameId == null && parsed.passwordId == null) {
                callback.onSuccess(null)
                return
            }

            val domain = parsed.webDomain
            val records = loadCache().filter { matchesDomain(it.domain, domain) }
            if (records.isEmpty()) {
                callback.onSuccess(null)
                return
            }

            val responseBuilder = FillResponse.Builder()
            for (record in records.take(24)) {
                val datasetLabel = if (record.username.isNotBlank()) {
                    "${'$'}{record.title}  ${'$'}{record.username}"
                } else {
                    record.title
                }
                val presentation = createPresentation(datasetLabel)
                val datasetBuilder = Dataset.Builder(presentation)

                if (parsed.usernameId != null && record.username.isNotBlank()) {
                    datasetBuilder.setValue(
                        parsed.usernameId,
                        AutofillValue.forText(record.username),
                        createPresentation(record.username)
                    )
                }

                if (parsed.passwordId != null) {
                    datasetBuilder.setValue(
                        parsed.passwordId,
                        AutofillValue.forText(record.password),
                        createPresentation("••••••••")
                    )
                }

                responseBuilder.addDataset(datasetBuilder.build())
            }

            callback.onSuccess(responseBuilder.build())
        } catch (error: Throwable) {
            Log.e(TAG, "Failed to build autofill response", error)
            callback.onSuccess(null)
        }
    }

    override fun onSaveRequest(request: SaveRequest, callback: SaveCallback) {
        callback.onSuccess()
    }

    private fun createPresentation(text: String): RemoteViews {
        return RemoteViews(packageName, android.R.layout.simple_list_item_1).apply {
            setTextViewText(android.R.id.text1, text)
        }
    }

    private fun loadCache(): List<CredentialRecord> {
        val cacheFile = File(filesDir, "${AUTOFILL_DIRECTORY}/${AUTOFILL_CACHE_FILENAME}")
        if (!cacheFile.exists()) {
            return emptyList()
        }

        val payload = JSONObject(cacheFile.readText())
        val records = payload.optJSONArray("records") ?: JSONArray()
        val result = mutableListOf<CredentialRecord>()

        for (index in 0 until records.length()) {
            val row = records.optJSONObject(index) ?: continue
            val password = row.optString("password")
            val domain = normalizeDomain(row.optString("domain"))
            if (password.isBlank() || domain.isBlank()) {
                continue
            }
            result += CredentialRecord(
                id = row.optString("id"),
                title = row.optString("title", domain),
                username = row.optString("username"),
                password = password,
                url = row.optString("url"),
                domain = domain
            )
        }

        return result
    }

    private fun traverseNode(node: AssistStructure.ViewNode?, parsed: ParsedFields) {
        if (node == null) {
            return
        }

        if (parsed.webDomain.isBlank()) {
            parsed.webDomain = normalizeDomain(node.webDomain)
        }

        val hintBag = buildHintBag(node)
        if (parsed.passwordId == null && isPasswordField(hintBag, node.inputType)) {
            parsed.passwordId = node.autofillId
        }
        if (parsed.usernameId == null && isUsernameField(hintBag, node.inputType)) {
            parsed.usernameId = node.autofillId
        }

        for (index in 0 until node.childCount) {
            traverseNode(node.getChildAt(index), parsed)
        }
    }

    private fun buildHintBag(node: AssistStructure.ViewNode): String {
        val values = mutableListOf<String>()
        node.autofillHints?.forEach { values += it }
        node.hint?.let(values::add)
        node.idEntry?.let(values::add)
        node.text?.let { values += it.toString() }
        return values.joinToString(" ").lowercase(Locale.US)
    }

    private fun isPasswordField(hintBag: String, inputType: Int): Boolean {
        val variation = inputType and InputType.TYPE_MASK_VARIATION
        val passwordVariation = variation == InputType.TYPE_TEXT_VARIATION_PASSWORD ||
            variation == InputType.TYPE_TEXT_VARIATION_VISIBLE_PASSWORD ||
            variation == InputType.TYPE_TEXT_VARIATION_WEB_PASSWORD ||
            variation == InputType.TYPE_NUMBER_VARIATION_PASSWORD

        return passwordVariation ||
            hintBag.contains("password") ||
            hintBag.contains("passcode") ||
            hintBag.contains("パスワード")
    }

    private fun isUsernameField(hintBag: String, inputType: Int): Boolean {
        if (isPasswordField(hintBag, inputType)) {
            return false
        }

        return hintBag.contains("username") ||
            hintBag.contains("email") ||
            hintBag.contains("login") ||
            hintBag.contains("account") ||
            hintBag.contains("user") ||
            hintBag.contains("メール") ||
            hintBag.contains("ユーザー")
    }

    private fun normalizeDomain(value: String?): String {
        val raw = value?.trim()?.lowercase(Locale.US).orEmpty()
        if (raw.isBlank()) {
            return ""
        }
        return raw
            .replace(Regex("^[a-z][a-z0-9+.-]*://"), "")
            .substringBefore("/")
            .substringBefore("?")
            .substringBefore("#")
            .substringBefore(":")
            .trim('.')
    }

    private fun matchesDomain(recordDomain: String, requestedDomain: String): Boolean {
        if (recordDomain.isBlank()) {
            return false
        }
        if (requestedDomain.isBlank()) {
            return true
        }
        return recordDomain == requestedDomain ||
            recordDomain.endsWith(".${'$'}requestedDomain") ||
            requestedDomain.endsWith(".${'$'}recordDomain")
    }
}
`;
}

function createAndroidSettingsActivitySource(options) {
    return `package ${options.androidAutofillPackage}

import android.app.Activity
import android.os.Bundle
import android.widget.Toast

class ${options.androidSettingsActivityName} : Activity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        packageManager.getLaunchIntentForPackage(packageName)?.let { launchIntent ->
            startActivity(launchIntent)
        }

        Toast.makeText(
            this,
            "PasswordManeger アプリを開いて Vault を解錠し、自動入力キャッシュを準備してください。",
            Toast.LENGTH_LONG
        ).show()
        finish()
    }
}
`;
}

function createIosInfoPlist() {
    return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleDevelopmentRegion</key>
    <string>$(DEVELOPMENT_LANGUAGE)</string>
    <key>CFBundleDisplayName</key>
    <string>PasswordManeger AutoFill</string>
    <key>CFBundleExecutable</key>
    <string>$(EXECUTABLE_NAME)</string>
    <key>CFBundleIdentifier</key>
    <string>$(PRODUCT_BUNDLE_IDENTIFIER)</string>
    <key>CFBundleInfoDictionaryVersion</key>
    <string>6.0</string>
    <key>CFBundleName</key>
    <string>$(PRODUCT_NAME)</string>
    <key>CFBundlePackageType</key>
    <string>XPC!</string>
    <key>CFBundleShortVersionString</key>
    <string>1.0</string>
    <key>CFBundleVersion</key>
    <string>1</string>
    <key>NSExtension</key>
    <dict>
        <key>NSExtensionPointIdentifier</key>
        <string>com.apple.authentication-services-credential-provider-ui</string>
        <key>NSExtensionPrincipalClass</key>
        <string>$(PRODUCT_MODULE_NAME).CredentialProviderViewController</string>
    </dict>
</dict>
</plist>
`;
}

function createIosEntitlements(options) {
    return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>com.apple.developer.authentication-services.autofill-credential-provider</key>
    <true/>
    <key>com.apple.security.application-groups</key>
    <array>
        <string>${options.appGroup}</string>
    </array>
</dict>
</plist>
`;
}

function createIosViewControllerSource(options) {
    return `import AuthenticationServices
import UIKit

private struct AutofillCache: Decodable {
    let version: Int
    let generatedAt: String
    let recordCount: Int
    let records: [CredentialRecord]
}

private struct CredentialRecord: Decodable {
    let id: String
    let title: String
    let username: String
    let password: String
    let url: String
    let domain: String
}

final class CredentialProviderViewController: ASCredentialProviderViewController, UITableViewDataSource, UITableViewDelegate {
    private let messageLabel = UILabel()
    private let actionButton = UIButton(type: .system)
    private let tableView = UITableView(frame: .zero, style: .insetGrouped)
    private var requestedDomain = ""
    private var candidates: [CredentialRecord] = []

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .systemBackground

        messageLabel.translatesAutoresizingMaskIntoConstraints = false
        messageLabel.numberOfLines = 0
        messageLabel.textAlignment = .center
        messageLabel.font = .preferredFont(forTextStyle: .body)
        messageLabel.text = "PasswordManeger で Vault を解錠すると、ここに候補が表示されます。"

        actionButton.translatesAutoresizingMaskIntoConstraints = false
        actionButton.setTitle("PasswordManeger を開く", for: .normal)
        actionButton.addTarget(self, action: #selector(openContainingApp), for: .touchUpInside)

        tableView.translatesAutoresizingMaskIntoConstraints = false
        tableView.dataSource = self
        tableView.delegate = self
        tableView.register(UITableViewCell.self, forCellReuseIdentifier: "CredentialCell")
        tableView.isHidden = true

        view.addSubview(messageLabel)
        view.addSubview(actionButton)
        view.addSubview(tableView)

        NSLayoutConstraint.activate([
            messageLabel.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor, constant: 16),
            messageLabel.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 24),
            messageLabel.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -24),

            actionButton.topAnchor.constraint(equalTo: messageLabel.bottomAnchor, constant: 16),
            actionButton.centerXAnchor.constraint(equalTo: view.centerXAnchor),

            tableView.topAnchor.constraint(equalTo: actionButton.bottomAnchor, constant: 20),
            tableView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            tableView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            tableView.bottomAnchor.constraint(equalTo: view.bottomAnchor)
        ])
    }

    override func prepareCredentialList(for serviceIdentifiers: [ASCredentialServiceIdentifier]) {
        requestedDomain = serviceIdentifiers
            .compactMap { normalizeDomain($0.identifier) }
            .first ?? ""
        loadCandidates(recordIdentifier: nil)
    }

    override func provideCredentialWithoutUserInteraction(for credentialIdentity: ASPasswordCredentialIdentity) {
        loadCandidates(recordIdentifier: credentialIdentity.recordIdentifier)

        guard let record = findRecord(by: credentialIdentity.recordIdentifier) else {
            let error = NSError(
                domain: ASExtensionErrorDomain,
                code: ASExtensionError.userInteractionRequired.rawValue,
                userInfo: [NSLocalizedDescriptionKey: "候補選択が必要です。"]
            )
            extensionContext.cancelRequest(withError: error)
            return
        }

        complete(record)
    }

    override func prepareInterfaceToProvideCredential(for credentialIdentity: ASPasswordCredentialIdentity) {
        loadCandidates(recordIdentifier: credentialIdentity.recordIdentifier)
    }

    override func prepareInterfaceForExtensionConfiguration() {
        requestedDomain = ""
        candidates = []
        updateEmptyState(
            "設定は追加済みです。PasswordManeger アプリを開いて Vault を解錠すると、AutoFill 候補を利用できます。"
        )
    }

    func tableView(_ tableView: UITableView, numberOfRowsInSection section: Int) -> Int {
        candidates.count
    }

    func tableView(_ tableView: UITableView, cellForRowAt indexPath: IndexPath) -> UITableViewCell {
        let cell = tableView.dequeueReusableCell(withIdentifier: "CredentialCell", for: indexPath)
        let record = candidates[indexPath.row]
        var config = cell.defaultContentConfiguration()
        config.text = record.username.isEmpty ? record.title : record.username
        config.secondaryText = record.title == record.domain ? record.domain : "\\(record.title) • \\(record.domain)"
        cell.contentConfiguration = config
        cell.accessoryType = .disclosureIndicator
        return cell
    }

    func tableView(_ tableView: UITableView, didSelectRowAt indexPath: IndexPath) {
        tableView.deselectRow(at: indexPath, animated: true)
        complete(candidates[indexPath.row])
    }

    private func loadCandidates(recordIdentifier: String?) {
        guard let cache = readCache() else {
            candidates = []
            updateEmptyState("Vault がまだ解錠されていません。PasswordManeger を開いて解錠してください。")
            return
        }

        var filtered = cache.records.filter { !$0.password.isEmpty && !$0.domain.isEmpty }
        if !requestedDomain.isEmpty {
            filtered = filtered.filter {
                matchesDomain($0.domain, requestedDomain) ||
                matchesDomain(normalizeDomain($0.url), requestedDomain)
            }
        }

        if let recordIdentifier, !recordIdentifier.isEmpty, let record = filtered.first(where: { $0.id == recordIdentifier }) {
            candidates = [record]
        } else {
            candidates = Array(filtered.prefix(24))
        }

        if candidates.isEmpty {
            let target = requestedDomain.isEmpty ? "現在の画面" : requestedDomain
            updateEmptyState("\\(target) に一致する候補がありません。")
        } else {
            tableView.reloadData()
            tableView.isHidden = false
            messageLabel.text = requestedDomain.isEmpty
                ? "PasswordManeger から候補を選んでください。"
                : "\\(requestedDomain) に一致する候補です。"
        }
    }

    private func updateEmptyState(_ message: String) {
        tableView.isHidden = true
        messageLabel.text = message
    }

    private func complete(_ record: CredentialRecord) {
        let username = record.username.isEmpty ? record.title : record.username
        let credential = ASPasswordCredential(user: username, password: record.password)
        extensionContext.completeRequest(withSelectedCredential: credential, completionHandler: nil)
    }

    private func findRecord(by identifier: String?) -> CredentialRecord? {
        guard let identifier, !identifier.isEmpty else {
            return nil
        }
        return candidates.first(where: { $0.id == identifier }) ?? readCache()?.records.first(where: { $0.id == identifier })
    }

    private func readCache() -> AutofillCache? {
        guard let containerURL = FileManager.default.containerURL(
            forSecurityApplicationGroupIdentifier: "${options.appGroup}"
        ) else {
            return nil
        }

        let fileURL = containerURL
            .appendingPathComponent("${AUTOFILL_DIRECTORY}", isDirectory: true)
            .appendingPathComponent("${AUTOFILL_CACHE_FILENAME}")

        guard let data = try? Data(contentsOf: fileURL) else {
            return nil
        }

        return try? JSONDecoder().decode(AutofillCache.self, from: data)
    }

    private func normalizeDomain(_ value: String) -> String {
        let raw = value.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        guard !raw.isEmpty else {
            return ""
        }

        if let host = URL(string: raw)?.host?.lowercased(), !host.isEmpty {
            return host
        }
        if let host = URL(string: "https://\\(raw)")?.host?.lowercased(), !host.isEmpty {
            return host
        }

        return raw
            .replacingOccurrences(of: #"^[a-z][a-z0-9+.-]*://"#, with: "", options: .regularExpression)
            .split(separator: "/")
            .first
            .map(String.init)?
            .split(separator: ":")
            .first
            .map(String.init)?
            .trimmingCharacters(in: CharacterSet(charactersIn: "."))
            ?? ""
    }

    private func matchesDomain(_ left: String, _ right: String) -> Bool {
        guard !left.isEmpty, !right.isEmpty else {
            return false
        }

        return left == right || left.hasSuffix(".\\(right)") || right.hasSuffix(".\\(left)")
    }

    @objc
    private func openContainingApp() {
        guard let url = URL(string: "passwordmaneger://autofill") else {
            return
        }

        extensionContext?.open(url, completionHandler: nil)
    }
}
`;
}

function createIosAppDelegateHelpers(options) {
    return `// PMAUTOFILL_SYNC_BEGIN
static NSString * const PMAutofillAppGroup = @"${options.appGroup}";
static NSString * const PMAutofillDirectoryName = @"${AUTOFILL_DIRECTORY}";
static NSString * const PMAutofillCacheFileName = @"${AUTOFILL_CACHE_FILENAME}";

static NSURL * PMAutofillSourceFileURL(void) {
  NSURL *documentsURL = [[[NSFileManager defaultManager] URLsForDirectory:NSDocumentDirectory inDomains:NSUserDomainMask] firstObject];
  NSURL *directoryURL = [documentsURL URLByAppendingPathComponent:PMAutofillDirectoryName isDirectory:YES];
  return [directoryURL URLByAppendingPathComponent:PMAutofillCacheFileName];
}

static NSURL * PMAutofillSharedFileURL(void) {
  NSURL *containerURL = [[NSFileManager defaultManager] containerURLForSecurityApplicationGroupIdentifier:PMAutofillAppGroup];
  if (!containerURL) {
    return nil;
  }
  NSURL *directoryURL = [containerURL URLByAppendingPathComponent:PMAutofillDirectoryName isDirectory:YES];
  [[NSFileManager defaultManager] createDirectoryAtURL:directoryURL withIntermediateDirectories:YES attributes:nil error:nil];
  return [directoryURL URLByAppendingPathComponent:PMAutofillCacheFileName];
}

static void PMAutofillSyncSharedCache(void) {
  NSURL *sourceURL = PMAutofillSourceFileURL();
  NSURL *targetURL = PMAutofillSharedFileURL();
  if (!targetURL) {
    return;
  }

  NSFileManager *fileManager = [NSFileManager defaultManager];
  if (![fileManager fileExistsAtPath:sourceURL.path]) {
    if ([fileManager fileExistsAtPath:targetURL.path]) {
      [fileManager removeItemAtURL:targetURL error:nil];
    }
    return;
  }

  if ([fileManager fileExistsAtPath:targetURL.path]) {
    [fileManager removeItemAtURL:targetURL error:nil];
  }
  [fileManager copyItemAtURL:sourceURL toURL:targetURL error:nil];
}
// PMAUTOFILL_SYNC_END
`;
}

function patchIosAppDelegateSource(source, options) {
    let next = source;
    const helperBlock = createIosAppDelegateHelpers(options);

    if (!next.includes("// PMAUTOFILL_SYNC_BEGIN")) {
        next = next.replace(/@implementation AppDelegate/, `${helperBlock}\n@implementation AppDelegate`);
    }

    if (!next.includes("PMAutofillSyncSharedCache();")) {
        next = next.replace(
            /return\s+\[super application:application didFinishLaunchingWithOptions:launchOptions\];/,
            `PMAutofillSyncSharedCache();\n  return [super application:application didFinishLaunchingWithOptions:launchOptions];`
        );
    }

    if (!next.includes("applicationDidEnterBackground:(UIApplication *)application")) {
        next = next.replace(
            /@end\s*$/,
            `- (void)applicationDidEnterBackground:(UIApplication *)application\n{\n  PMAutofillSyncSharedCache();\n  [super applicationDidEnterBackground:application];\n}\n\n- (void)applicationDidBecomeActive:(UIApplication *)application\n{\n  PMAutofillSyncSharedCache();\n  [super applicationDidBecomeActive:application];\n}\n\n@end\n`
        );
    }

    return next;
}

function withPasswordManegerAndroidAutofill(config, props) {
    config = withAndroidManifest(config, (nextConfig) => {
        const options = getOptions(nextConfig, props);
        const application = nextConfig.modResults.manifest.application?.[0];

        if (!application) {
            throw new Error(`${PLUGIN_NAME}: AndroidManifest.xml is missing <application>.`);
        }

        ensureAndroidServiceEntry(application, options);
        ensureAndroidSettingsActivity(application, options);
        return nextConfig;
    });

    config = withDangerousMod(config, ["android", async (nextConfig) => {
        const options = getOptions(nextConfig, props);
        const root = nextConfig.modRequest.platformProjectRoot;
        const javaRoot = path.join(root, "app", "src", "main", "java", toJavaPackagePath(options.androidAutofillPackage));
        const resXmlRoot = path.join(root, "app", "src", "main", "res", "xml");

        await writeFileIfChanged(
            path.join(javaRoot, `${options.androidServiceName}.kt`),
            createAndroidAutofillServiceSource(options)
        );
        await writeFileIfChanged(
            path.join(javaRoot, `${options.androidSettingsActivityName}.kt`),
            createAndroidSettingsActivitySource(options)
        );
        await writeFileIfChanged(
            path.join(resXmlRoot, `${options.androidAutofillXmlName}.xml`),
            createAndroidAutofillXml(options)
        );

        return nextConfig;
    }]);

    return config;
}

function withPasswordManegerIosAutofill(config, props) {
    config = withEntitlementsPlist(config, (nextConfig) => {
        const options = getOptions(nextConfig, props);
        nextConfig.modResults = mergeMainAppGroup(nextConfig.modResults, options.appGroup);
        return nextConfig;
    });

    config = withDangerousMod(config, ["ios", async (nextConfig) => {
        const options = getOptions(nextConfig, props);
        const root = nextConfig.modRequest.platformProjectRoot;
        const extensionRoot = path.join(root, options.iosExtensionName);

        await writeFileIfChanged(
            path.join(extensionRoot, "CredentialProviderViewController.swift"),
            createIosViewControllerSource(options)
        );
        await writeFileIfChanged(
            path.join(extensionRoot, "Info.plist"),
            createIosInfoPlist(options)
        );
        await writeFileIfChanged(
            path.join(extensionRoot, `${options.iosExtensionName}.entitlements`),
            createIosEntitlements(options)
        );

        try {
            const appDelegatePath = await findIosAppDelegatePath(root);
            const current = await fs.readFile(appDelegatePath, "utf8");
            const next = patchIosAppDelegateSource(current, options);
            if (next !== current) {
                await fs.writeFile(appDelegatePath, next, "utf8");
            }
        } catch (error) {
            throw new Error(`${PLUGIN_NAME}: failed to patch iOS AppDelegate at ${appDelegatePath}: ${error.message}`);
        }

        return nextConfig;
    }]);

    config = withXcodeProject(config, (nextConfig) => {
        const options = getOptions(nextConfig, props);
        const project = nextConfig.modResults;

        let targetEntry = findTargetEntry(project, options.iosExtensionName);
        let targetUuid;
        let nativeTarget;

        if (targetEntry) {
            [targetUuid, nativeTarget] = targetEntry;
        } else {
            const created = project.addTarget(
                options.iosExtensionName,
                "app_extension",
                options.iosExtensionName,
                options.iosExtensionBundleIdentifier
            );
            targetUuid = created.uuid;
            nativeTarget = created.pbxNativeTarget;
        }

        IOSConfig.XcodeUtils.ensureGroupRecursively(project, options.iosExtensionName);
        IOSConfig.XcodeUtils.addBuildSourceFileToGroup({
            filepath: options.iosExtensionSourceFile,
            groupName: options.iosExtensionName,
            project,
            targetUuid,
        });

        for (const [, buildConfig] of IOSConfig.XcodeUtils.getBuildConfigurationsForListId(
            project,
            nativeTarget.buildConfigurationList
        )) {
            buildConfig.buildSettings.PRODUCT_BUNDLE_IDENTIFIER = `"${options.iosExtensionBundleIdentifier}"`;
            buildConfig.buildSettings.INFOPLIST_FILE = `"${options.iosExtensionInfoPlistFile}"`;
            buildConfig.buildSettings.CODE_SIGN_ENTITLEMENTS = `"${options.iosExtensionEntitlementsFile}"`;
            buildConfig.buildSettings.SWIFT_VERSION = "5.0";
            buildConfig.buildSettings.IPHONEOS_DEPLOYMENT_TARGET = buildConfig.buildSettings.IPHONEOS_DEPLOYMENT_TARGET || "15.1";
            buildConfig.buildSettings.SKIP_INSTALL = "YES";
            buildConfig.buildSettings.SUPPORTS_MACCATALYST = "NO";
            buildConfig.buildSettings.APPLICATION_EXTENSION_API_ONLY = "YES";
        }

        project.addTargetAttribute("DevelopmentTeam", "$(DEVELOPMENT_TEAM)", { uuid: targetUuid });
        project.addTargetAttribute("ProvisioningStyle", "Automatic", { uuid: targetUuid });

        return nextConfig;
    });

    return config;
}

const withPasswordManegerNativeAutofill = (config, props = {}) => {
    config = withPasswordManegerAndroidAutofill(config, props);
    config = withPasswordManegerIosAutofill(config, props);
    return config;
};

module.exports = createRunOncePlugin(
    withPasswordManegerNativeAutofill,
    PLUGIN_NAME,
    PLUGIN_VERSION
);
