export const OPTIONS_CONTENT = {
  "en": {
    "overview": {
      "title": "Powerful even without cloud sync",
      "sub": "You can use local storage, autofill, capture, and security review with just the extension. Paid cloud sync is optional when you need multiple devices.",
      "pills": ["Local encryption (AES-256-GCM)", "Risk-based autofill", "Form learning", "Import preview"],
      "questionTitle": "Can I use it without a server?",
      "questionHint": "Yes. The extension works by itself with a local vault. A server is only required for paid cloud sync and emergency recovery workflows.",
      "capabilities": [
        { "label": "Works in extension only", "text": "Save items, autofill, backup, import, and run security review." },
        { "label": "Requires server", "text": "Billing, cloud sync, and encrypted emergency access collection." }
      ]
    },
    "features": {
      "title": "What this extension can do",
      "items": [
        "Securely store logins, cards, identities, notes, and passkeys in a locally encrypted vault.",
        "Show matching suggestions for the current site and autofill with one click.",
        "Use risk-based autofill to warn or block on suspicious domains or non-HTTPS pages.",
        "Learn site-specific form fields after manual correction and allow reset when learning is wrong.",
        "Detect submitted login forms and propose them as save suggestions.",
        "Run a local security review with prioritized guidance for weak or reused passwords.",
        "Import from other services such as 1Password, Bitwarden, LastPass, CSV, and JSON with preview.",
        "Export and import encrypted JSON backups manually.",
        "Sync encrypted vault snapshots through the paid cloud service."
      ]
    },
    "usage": {
      "title": "Quick start",
      "steps": [
        { "title": "Create a vault", "text": "Open the extension popup and set a master password." },
        { "title": "Save an item", "text": "Save a login item with URL, username, and password." },
        { "title": "Autofill", "text": "Open the matching login page and autofill from the current site tab." }
      ]
    },
    "warnings": {
      "title": "Important notes",
      "items": [
        { "label": "Lost master password", "text": "If you forget it, the data cannot be decrypted or recovered." },
        { "label": "Cloud sync limits", "text": "Cloud sync is available only for paid users and the server verifies plan status." },
        { "label": "Autofill accuracy", "text": "Different site DOM structures can cause autofill misses or field mismatches." },
        { "label": "Form learning limits", "text": "Automatic learning can be wrong, so reset it if the behavior looks strange." }
      ]
    },
    "trouble": {
      "title": "Common troubleshooting",
      "learningTitle": "Reset form learning",
      "learningHint": "Review learned autofill mappings here and delete only the ones you do not want to keep.",
      "defaultStatus": "When this page is opened as the extension Options page, the learning summary appears here.",
      "empty": "No learning data yet. After you correct an autofill manually and log in, history appears here.",
      "faqs": [
        { "q": "No suggestions appear", "a": "Check whether the saved item has the correct login URL." },
        { "q": "Autofill fills the wrong field", "a": "Paste the data into the correct fields manually once and sign in again so the extension can learn." },
        { "q": "Learning is broken", "a": "Reset learning for the current site or all sites from this page." },
        { "q": "Cloud sync fails", "a": "Check that your paid plan is active, the sync base URL is correct, and cloud login is complete." }
      ]
    }
  },
  "ja": {
    "overview": {
      "title": "クラウド同期なしでも強力な機能",
      "sub": "拡張機能だけで、ローカル保存、自動入力、キャプチャ、セキュリティ診断を利用できます。有料のクラウド同期は、複数デバイスが必要な場合のみのオプションです。",
      "pills": ["ローカル暗号化 (AES-256-GCM)", "リスクベース自動入力", "フォーム学習", "インポートプレビュー"],
      "questionTitle": "サーバーなしで使用できますか？",
      "questionHint": "はい。拡張機能はローカルヴォルト単体で動作します。サーバーは有料のクラウド同期と緊急時復旧ワークフローにのみ必要です。",
      "capabilities": [
        { "label": "拡張機能のみで動作", "text": "アイテムの保存、自動入力、バックアップ、インポート、セキュリティ診断。" },
        { "label": "サーバーが必要", "text": "支払い管理、クラウド同期、暗号化された緊急アクセス収集。" }
      ]
    },
    "features": {
      "title": "この拡張機能でできること",
      "items": [
        "ログイン情報、カード、ID、メモ、パスキーをローカルに暗号化されたヴォルトに安全に保管します。",
        "現在のサイトに一致する候補を表示し、ワンクリックで自動入力します。",
        "不審なドメインや非HTTPSページでの警告またはブロックを行うリスクベース自動入力を提供します。",
        "手動修正後にサイト固有のフォームフィールドを学習し、誤学習時はリセット可能です。",
        "送信されたログインフォームを検出し、保存候補として提案します。",
        "脆弱なパスワードや使い回されたパスワードに対して優先順位を付けたセキュリティ診断を実行します。",
        "1Password、Bitwarden、LastPass、CSV、JSONなどからプレビュー付きでインポートできます。",
        "暗号化されたJSONバックアップを手動でエクスポートおよびインポートできます。",
        "有料クラウドサービスを通じて暗号化されたヴォルトのスナップショットを同期します。"
      ]
    },
    "usage": {
      "title": "クイックスタート",
      "steps": [
        { "title": "ヴォルトの作成", "text": "拡張機能のポップアップを開き、マスターパスワードを設定します。" },
        { "title": "アイテムの保存", "text": "URL、ユーザー名、パスワードを入力してログインアイテムを保存します。" },
        { "title": "自動入力", "text": "一致するログインページを開き、現在のサイトタブから自動入力します。" }
      ]
    },
    "warnings": {
      "title": "重要な注意事項",
      "items": [
        { "label": "マスターパスワードの紛失", "text": "忘れた場合、データを復号または復旧することは不可能です。" },
        { "label": "クラウド同期の制限", "text": "クラウド同期は有料ユーザーのみ利用可能で、サーバーでプランの状態を検証します。" },
        { "label": "自動入力の精度", "text": "サイトのDOM構造の違いにより、自動入力の失敗やフィールドの不一致が発生する場合があります。" },
        { "label": "フォーム学習の制限", "text": "自動学習が誤る場合があるため、動作がおかしい場合はリセットしてください。" }
      ]
    },
    "trouble": {
      "title": "よくあるトラブルシューティング",
      "learningTitle": "フォーム学習のリセット",
      "learningHint": "ここで学習済みの自動入力マッピングを確認し、保持したくないものだけを削除してください。",
      "defaultStatus": "このページを拡張機能のオプションページとして開くと、学習の概要がここに表示されます。",
      "empty": "学習データはまだありません。手動で自動入力を修正してログインすると、履歴が表示されます。",
      "faqs": [
        { "q": "候補が表示されない", "a": "保存されたアイテムに正しいログインURLが設定されているか確認してください。" },
        { "q": "自動入力が間違ったフィールドに入る", "a": "一度手動で正しいフィールドに貼り付けてログインし直すと、拡張機能が学習します。" },
        { "q": "学習が壊れている", "a": "このページから、現在のサイトまたは全サイトの学習をリセットしてください。" },
        { "q": "クラウド同期が失敗する", "a": "有料プランが有効か、同期ベースURLが正しいか、クラウドログインが完了しているか確認してください。" }
      ]
    }
  },
  "es": {
    "overview": {
      "title": "Potente incluso sin sincronización en la nube",
      "sub": "Puede usar el almacenamiento local, el autocompletado, la captura y la revisión de seguridad solo con la extensión. La sincronización paga es opcional.",
      "pills": ["Cifrado local (AES-256-GCM)", "Autocompletado por riesgo", "Aprendizaje de formularios", "Vista previa de importación"],
      "questionTitle": "¿Puedo usarlo sin un servidor?",
      "questionHint": "Sí. La extensión funciona sola con una bóveda local. Solo se requiere servidor para la sincronización paga y recuperación de emergencia.",
      "capabilities": [
        { "label": "Solo en extensión", "text": "Guardar ítems, autocompletar, respaldar, importar y revisión de seguridad." },
        { "label": "Requiere servidor", "text": "Facturación, sincronización en la nube y acceso de emergencia cifrado." }
      ]
    },
    "features": {
      "title": "Qué puede hacer esta extensión",
      "items": [
        "Almacene de forma segura inicios de sesión, tarjetas, notas y llaves de paso en una bóveda cifrada localmente.",
        "Muestra sugerencias para el sitio actual y autocompleta con un clic.",
        "Advierte o bloquea en dominios sospechosos o páginas no HTTPS mediante análisis de riesgo.",
        "Aprende campos específicos del sitio tras corrección manual y permite reiniciar el aprendizaje.",
        "Detecta formularios de inicio de sesión enviados y los propone para guardar.",
        "Realiza una revisión de seguridad local con guía para contraseñas débiles o reutilizadas.",
        "Importa desde 1Password, Bitwarden, LastPass, CSV y JSON con vista previa.",
        "Exporta e importa respaldos JSON cifrados de forma manual.",
        "Sincroniza instantáneas de la bóveda a través del servicio pago en la nube."
      ]
    },
    "usage": {
      "title": "Inicio rápido",
      "steps": [
        { "title": "Crear bóveda", "text": "Abra la extensión y establezca una contraseña maestra." },
        { "title": "Guardar ítem", "text": "Guarde un inicio de sesión con URL, usuario y contraseña." },
        { "title": "Autocompletar", "text": "Abra la página de inicio de sesión y use la pestaña del sitio actual." }
      ]
    },
    "warnings": {
      "title": "Notas importantes",
      "items": [
        { "label": "Contraseña maestra perdida", "text": "Si la olvida, los datos no pueden ser descifrados ni recuperados." },
        { "label": "Límites de sincronización", "text": "Disponible solo para usuarios de pago; el servidor verifica el estado del plan." },
        { "label": "Precisión de autocompletado", "text": "Estructuras DOM diferentes pueden causar fallos o errores de campo." },
        { "label": "Límites de aprendizaje", "text": "El aprendizaje automático puede fallar; reinícielo si nota comportamientos extraños." }
      ]
    },
    "trouble": {
      "title": "Solución de problemas",
      "learningTitle": "Reiniciar aprendizaje",
      "learningHint": "Revise los mapeos aprendidos aquí y elimine solo los que no desee conservar.",
      "defaultStatus": "Al abrir esta página como Opciones, el resumen de aprendizaje aparece aquí.",
      "empty": "Sin datos aún. Tras corregir un autocompletado e iniciar sesión, el historial aparecerá aquí.",
      "faqs": [
        { "q": "No aparecen sugerencias", "a": "Verifique que el ítem guardado tenga la URL de inicio de sesión correcta." },
        { "q": "Completa el campo erróneo", "a": "Pegue los datos manualmente una vez e inicie sesión para que la extensión aprenda." },
        { "q": "Aprendizaje dañado", "a": "Reinicie el aprendizaje para el sitio actual o para todos desde esta página." },
        { "q": "Fallo de sincronización", "a": "Verifique su plan activo, la URL de sincronización y el inicio de sesión en la nube." }
      ]
    }
  },
  "fr": {
    "overview": {
      "title": "Puissant même sans synchronisation cloud",
      "sub": "Utilisez le stockage local, la saisie automatique et l'audit de sécurité avec l'extension seule. Le cloud payant est optionnel pour le multi-appareil.",
      "pills": ["Chiffrement local (AES-256-GCM)", "Saisie basée sur les risques", "Apprentissage de formulaires", "Aperçu d'importation"],
      "questionTitle": "Utilisable sans serveur ?",
      "questionHint": "Oui. L'extension fonctionne seule avec un coffre local. Le serveur n'est requis que pour la synchro payante et la récupération d'urgence.",
      "capabilities": [
        { "label": "Extension seule", "text": "Enregistrement, saisie automatique, sauvegarde, import et audit de sécurité." },
        { "label": "Serveur requis", "text": "Facturation, synchro cloud et accès d'urgence chiffré." }
      ]
    },
    "features": {
      "title": "Fonctionnalités de l'extension",
      "items": [
        "Stockez identifiants, cartes, notes et passkeys dans un coffre chiffré localement.",
        "Affiche des suggestions pour le site actuel et remplit en un clic.",
        "Avertit ou bloque sur les domaines suspects ou non-HTTPS.",
        "Apprend les champs spécifiques après correction manuelle et permet la réinitialisation.",
        "Détecte les formulaires soumis et propose de les enregistrer.",
        "Exécute un audit de sécurité local pour les mots de passe faibles ou réutilisés.",
        "Importe depuis 1Password, Bitwarden, LastPass, CSV et JSON avec aperçu.",
        "Exporte et importe manuellement des sauvegardes JSON chiffrées.",
        "Synchronise les instantanés du coffre via le service cloud payant."
      ]
    },
    "usage": {
      "title": "Démarrage rapide",
      "steps": [
        { "title": "Créer un coffre", "text": "Ouvrez le popup et définissez un mot de passe maître." },
        { "title": "Enregistrer un item", "text": "Sauvegardez une URL, un identifiant et un mot de passe." },
        { "title": "Saisie automatique", "text": "Ouvrez la page de connexion et remplissez depuis l'onglet du site." }
      ]
    },
    "warnings": {
      "title": "Notes importantes",
      "items": [
        { "label": "Mot de passe maître perdu", "text": "En cas d'oubli, les données ne peuvent être ni déchiffrées ni récupérées." },
        { "label": "Limites de synchro", "text": "Disponible pour les utilisateurs payants ; le serveur vérifie le statut du compte." },
        { "label": "Précision de saisie", "text": "Les structures DOM complexes peuvent causer des erreurs de remplissage." },
        { "label": "Limites d'apprentissage", "text": "L'apprentissage peut échouer ; réinitialisez-le en cas de comportement anormal." }
      ]
    },
    "trouble": {
      "title": "Dépannage courant",
      "learningTitle": "Réinitialiser l'apprentissage",
      "learningHint": "Gérez ici les mappages appris et supprimez ceux que vous ne voulez pas garder.",
      "defaultStatus": "Le résumé d'apprentissage s'affiche ici lorsqu'ouvert via les Options.",
      "empty": "Aucune donnée. L'historique apparaîtra après une correction manuelle suivie d'une connexion.",
      "faqs": [
        { "q": "Aucune suggestion", "a": "Vérifiez que l'URL enregistrée correspond bien au site actuel." },
        { "q": "Mauvais champ rempli", "a": "Collez manuellement les données une fois pour forcer l'apprentissage." },
        { "q": "Apprentissage erroné", "a": "Réinitialisez l'apprentissage pour ce site ou tous les sites ici." },
        { "q": "Échec de synchro cloud", "a": "Vérifiez votre abonnement, l'URL de base et votre connexion cloud." }
      ]
    }
  },
  "de": {
    "overview": {
      "title": "Leistungsstark auch ohne Cloud",
      "sub": "Lokale Speicherung, Ausfüllen und Sicherheitscheck funktionieren allein mit der Erweiterung. Cloud-Sync ist optional für mehrere Geräte.",
      "pills": ["Lokale Verschlüsselung", "Risikobasiertes Ausfüllen", "Formular-Lernen", "Import-Vorschau"],
      "questionTitle": "Ohne Server nutzbar?",
      "questionHint": "Ja. Die Erweiterung arbeitet autark mit einem lokalen Tresor. Ein Server wird nur für Cloud-Sync und Notfallzugriff benötigt.",
      "capabilities": [
        { "label": "Nur Erweiterung", "text": "Speichern, Ausfüllen, Backup, Import und Sicherheitsprüfung." },
        { "label": "Server erforderlich", "text": "Abrechnung, Cloud-Sync und verschlüsselter Notfallzugriff." }
      ]
    },
    "features": {
      "title": "Funktionen dieser Erweiterung",
      "items": [
        "Sicheres Speichern von Logins, Karten und Passkeys in einem lokalen Tresor.",
        "Passende Vorschläge für die aktuelle Seite und Ausfüllen mit einem Klick.",
        "Warnung vor verdächtigen Domains oder unverschlüsselten HTTP-Seiten.",
        "Lernen von Formularfeldern nach Korrektur und Möglichkeit zum Zurücksetzen.",
        "Erkennung gesendeter Formulare mit Vorschlag zum Speichern.",
        "Lokaler Sicherheitscheck für schwache oder doppelte Passwörter.",
        "Import von 1Password, Bitwarden, LastPass, CSV und JSON mit Vorschau.",
        "Manueller Export und Import verschlüsselter JSON-Backups.",
        "Synchronisierung verschlüsselter Tresor-Snapshots über den Cloud-Dienst."
      ]
    },
    "usage": {
      "title": "Schnellstart",
      "steps": [
        { "title": "Tresor erstellen", "text": "Popup öffnen und ein Master-Passwort festlegen." },
        { "title": "Eintrag speichern", "text": "Speichern Sie URL, Benutzername und Passwort." },
        { "title": "Automatisches Ausfüllen", "text": "Login-Seite öffnen und über den Tab ausfüllen." }
      ]
    },
    "warnings": {
      "title": "Wichtige Hinweise",
      "items": [
        { "label": "Master-Passwort vergessen", "text": "Daten können ohne Passwort nicht entschlüsselt oder wiederhergestellt werden." },
        { "label": "Cloud-Sync-Limits", "text": "Nur für zahlende Nutzer; der Server prüft den Abo-Status." },
        { "label": "Genauigkeit", "text": "Komplexe Website-Strukturen können zu Fehlern beim Ausfüllen führen." },
        { "label": "Lern-Limits", "text": "Die Automatik kann irren; setzen Sie das Lernen bei Fehlern zurück." }
      ]
    },
    "trouble": {
      "title": "Fehlerbehebung",
      "learningTitle": "Lernen zurücksetzen",
      "learningHint": "Prüfen Sie hier gelernte Zuordnungen und löschen Sie ungewollte Einträge.",
      "defaultStatus": "In den Optionen wird hier die Zusammenfassung des Lernens angezeigt.",
      "empty": "Noch keine Lerndaten. Erscheint nach manueller Korrektur und Login.",
      "faqs": [
        { "q": "Keine Vorschläge", "a": "Prüfen Sie, ob die gespeicherte URL korrekt ist." },
        { "q": "Falsches Feld ausgefüllt", "a": "Daten einmal manuell einfügen und einloggen, um das Feld zu lernen." },
        { "q": "Lernen fehlerhaft", "a": "Setzen Sie das Lernen für die Seite oder global hier zurück." },
        { "q": "Cloud-Sync schlägt fehl", "a": "Prüfen Sie Abo, Basis-URL und Cloud-Login-Status." }
      ]
    }
  },
  "pt-BR": {
    "overview": {
      "title": "Poderoso mesmo sem nuvem",
      "sub": "Use armazenamento local, preenchimento e análise de segurança apenas com a extensão. Sincronização paga é opcional para múltiplos dispositivos.",
      "pills": ["Criptografia local (AES-256)", "Preenchimento por risco", "Aprendizado de formulário", "Prévia de importação"],
      "questionTitle": "Funciona sem servidor?",
      "questionHint": "Sim. A extensão funciona sozinha com um cofre local. Servidor é exigido apenas para sincronização paga e acesso de emergência.",
      "capabilities": [
        { "label": "Apenas na extensão", "text": "Salvar itens, preencher, backup, importar e análise de segurança." },
        { "label": "Requer servidor", "text": "Faturamento, sincronização em nuvem e acesso de emergência." }
      ]
    },
    "features": {
      "title": "O que esta extensão faz",
      "items": [
        "Armazene logins, cartões, notas e passkeys em um cofre local criptografado.",
        "Sugestões para o site atual e preenchimento com um clique.",
        "Avisos ou bloqueios em domínios suspeitos ou páginas sem HTTPS.",
        "Aprende campos específicos após correção manual; permite resetar aprendizado.",
        "Detecta formulários enviados e propõe salvamento.",
        "Análise de segurança local para senhas fracas ou reutilizadas.",
        "Importação de 1Password, Bitwarden, LastPass, CSV e JSON com prévia.",
        "Exportação e importação manual de backups JSON criptografados.",
        "Sincronização de snapshots do cofre via serviço de nuvem pago."
      ]
    },
    "usage": {
      "title": "Início rápido",
      "steps": [
        { "title": "Criar cofre", "text": "Abra o popup e defina uma senha mestra." },
        { "title": "Salvar item", "text": "Guarde login com URL, usuário e senha." },
        { "title": "Preencher", "text": "Abra a página de login e use a aba do site atual." }
      ]
    },
    "warnings": {
      "title": "Notas importantes",
      "items": [
        { "label": "Senha mestra perdida", "text": "Se esquecer, os dados não podem ser descriptografados ou recuperados." },
        { "label": "Limites de nuvem", "text": "Disponível apenas para usuários pagos; o servidor valida o plano." },
        { "label": "Precisão de preenchimento", "text": "Estruturas de sites complexas podem causar falhas no preenchimento." },
        { "label": "Limites de aprendizado", "text": "O aprendizado automático pode errar; resete-o se notar falhas." }
      ]
    },
    "trouble": {
      "title": "Solução de problemas",
      "learningTitle": "Resetar aprendizado",
      "learningHint": "Revise mapeamentos aprendidos e exclua apenas os que não deseja manter.",
      "defaultStatus": "O resumo de aprendizado aparece aqui quando aberto via Opções.",
      "empty": "Sem dados. O histórico aparece após correção manual e login.",
      "faqs": [
        { "q": "Sem sugestões", "a": "Verifique se a URL salva está correta para o site." },
        { "q": "Campo errado preenchido", "a": "Cole os dados manualmente uma vez para que a extensão aprenda." },
        { "q": "Aprendizado quebrado", "a": "Resete o aprendizado para o site ou globalmente nesta página." },
        { "q": "Falha na nuvem", "a": "Verifique plano ativo, URL base e se o login na nuvem foi feito." }
      ]
    }
  },
  "zh-CN": {
    "overview": {
      "title": "即使没有云同步也很强大",
      "sub": "仅凭扩展程序即可使用本地存储、自动填充和安全审核。付费云同步仅在多设备使用时可选。",
      "pills": ["本地加密 (AES-256-GCM)", "基于风险的自动填充", "表单学习", "导入预览"],
      "questionTitle": "没有服务器可以使用吗？",
      "questionHint": "可以。扩展程序可配合本地保险库独立运行。仅付费云同步和紧急恢复需要服务器。",
      "capabilities": [
        { "label": "仅限扩展程序", "text": "保存项目、自动填充、备份、导入和执行安全审核。" },
        { "label": "需要服务器", "text": "账单管理、云同步和加密紧急访问收集。" }
      ]
    },
    "features": {
      "title": "此扩展程序的功能",
      "items": [
        "在本地加密保险库中安全存储登录信息、卡片、身份、笔记和通行密钥。",
        "显示当前网站的匹配建议，并实现一键自动填充。",
        "针对可疑域名或非 HTTPS 页面使用基于风险的自动填充警告或拦截。",
        "在手动纠正后学习特定站点的表单字段，并允许在学习错误时重置。",
        "检测已提交的登录表单并提议将其保存。",
        "运行本地安全审核，为弱密码或重复使用的密码提供优先建议。",
        "支持从 1Password、Bitwarden、LastPass、CSV 和 JSON 导入并提供预览。",
        "手动导出和导入加密的 JSON 备份。",
        "通过付费云服务同步加密的保险库快照。"
      ]
    },
    "usage": {
      "title": "快速入门",
      "steps": [
        { "title": "创建保险库", "text": "打开扩展程序弹窗并设置主密码。" },
        { "title": "保存项目", "text": "保存包含 URL、用户名和密码的登录项目。" },
        { "title": "自动填充", "text": "打开匹配的登录页面，从当前站点标签页进行填充。" }
      ]
    },
    "warnings": {
      "title": "重要提示",
      "items": [
        { "label": "主密码丢失", "text": "如果遗忘主密码，数据将无法解密或恢复。" },
        { "label": "云同步限制", "text": "云同步仅供付费用户使用，服务器会验证订阅状态。" },
        { "label": "自动填充准确性", "text": "不同的站点 DOM 结构可能导致自动填充失败或字段不匹配。" },
        { "label": "表单学习限制", "text": "自动学习可能出错，若行为异常请重置学习记录。" }
      ]
    },
    "trouble": {
      "title": "常见故障排除",
      "learningTitle": "重置表单学习",
      "learningHint": "在此查看已学习的自动填充映射，并仅删除您不想保留的项目。",
      "defaultStatus": "当此页面作为扩展选项页打开时，学习摘要将显示在此处。",
      "empty": "暂无学习数据。手动纠正填充并登录后，历史记录将显示在此处。",
      "faqs": [
        { "q": "未显示建议", "a": "请检查保存的项目是否具有正确的登录 URL。" },
        { "q": "填充了错误的字段", "a": "手动将数据粘贴到正确字段一次并再次登录，以便扩展程序学习。" },
        { "q": "学习记录损坏", "a": "在此页面重置当前网站或所有网站的学习记录。" },
        { "q": "云同步失败", "a": "检查付费方案是否激活、同步基础 URL 是否正确以及云端登录是否完成。" }
      ]
    }
  },
  "ko": {
    "overview": {
      "title": "클라우드 동기화 없이도 강력합니다",
      "sub": "확장 프로그램만으로 로컬 저장, 자동 채우기 및 보안 검토를 사용할 수 있습니다. 유료 동기화는 여러 기기가 필요한 경우에만 선택 사항입니다.",
      "pills": ["로컬 암호화 (AES-256)", "위험 기반 자동 채우기", "폼 학습", "가져오기 미리보기"],
      "questionTitle": "서버 없이 사용할 수 있나요?",
      "questionHint": "네. 확장 프로그램은 로컬 볼트를 통해 단독으로 작동합니다. 서버는 유료 동기화 및 비상 복구에만 필요합니다.",
      "capabilities": [
        { "label": "확장 프로그램 전용", "text": "항목 저장, 자동 채우기, 백업, 가져오기 및 보안 검토 수행." },
        { "label": "서버 필요", "text": "결제 관리, 클라우드 동기화 및 암호화된 비상 액세스 수집." }
      ]
    },
    "features": {
      "title": "확장 프로그램 주요 기능",
      "items": [
        "로컬로 암호화된 볼트에 로그인, 카드, 메모 및 패스키를 안전하게 저장합니다.",
        "현재 사이트에 일치하는 제안을 표시하고 클릭 한 번으로 자동 채웁니다.",
        "의심스러운 도메인이나 비 HTTPS 페이지에서 위험 기반 자동 채우기 경고를 사용합니다.",
        "수동 수정 후 사이트별 폼 필드를 학습하며, 잘못된 경우 재설정할 수 있습니다.",
        "제출된 로그인 폼을 감지하여 저장 제안으로 표시합니다.",
        "취약하거나 재사용된 비밀번호에 대해 우선순위가 지정된 보안 검토를 실행합니다.",
        "1Password, Bitwarden, LastPass, CSV, JSON에서 미리보기와 함께 가져옵니다.",
        "암호화된 JSON 백업을 수동으로 내보내고 가져옵니다.",
        "유료 클라우드 서비스를 통해 암호화된 볼트 스냅샷을 동기화합니다."
      ]
    },
    "usage": {
      "title": "빠른 시작",
      "steps": [
        { "title": "볼트 생성", "text": "팝업을 열고 마스터 비밀번호를 설정하세요." },
        { "title": "항목 저장", "text": "URL, 사용자 이름, 비밀번호를 포함한 항목을 저장하세요." },
        { "title": "자동 채우기", "text": "로그인 페이지를 열고 현재 사이트 탭에서 자동 채우기를 사용하세요." }
      ]
    },
    "warnings": {
      "title": "중요 참고 사항",
      "items": [
        { "label": "마스터 비밀번호 분실", "text": "비밀번호를 잊어버리면 데이터를 복호화하거나 복구할 수 없습니다." },
        { "label": "클라우드 동기화 제한", "text": "유료 사용자만 이용 가능하며 서버에서 플랜 상태를 확인합니다." },
        { "label": "자동 채우기 정확도", "text": "사이트의 DOM 구조에 따라 필드 불일치가 발생할 수 있습니다." },
        { "label": "폼 학습 제한", "text": "자동 학습이 틀릴 수 있으므로 동작이 이상하면 재설정하세요." }
      ]
    },
    "trouble": {
      "title": "일반적인 문제 해결",
      "learningTitle": "폼 학습 재설정",
      "learningHint": "학습된 매핑을 검토하고 보관하고 싶지 않은 항목만 삭제하세요.",
      "defaultStatus": "옵션 페이지로 열릴 때 학습 요약이 여기에 표시됩니다.",
      "empty": "학습 데이터가 없습니다. 수동 수정 후 로그인하면 기록이 나타납니다.",
      "faqs": [
        { "q": "제안이 나타나지 않음", "a": "저장된 항목에 올바른 로그인 URL이 있는지 확인하세요." },
        { "q": "잘못된 필드에 채워짐", "a": "데이터를 수동으로 한 번 붙여넣고 로그인하여 다시 학습시키세요." },
        { "q": "학습 기록 오류", "a": "이 페이지에서 현재 사이트 또는 전체 사이트 학습을 재설정하세요." },
        { "q": "클라우드 동기화 실패", "a": "플랜 활성화 여부, URL 및 로그인 상태를 확인하세요." }
      ]
    }
  }
};

export function getOptionsContent(locale = "en") {
  return OPTIONS_CONTENT[locale] || OPTIONS_CONTENT.en;
}
