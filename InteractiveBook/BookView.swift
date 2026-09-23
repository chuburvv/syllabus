import SwiftUI
import WebKit

struct BookView: UIViewRepresentable {
    func makeCoordinator() -> Coordinator { Coordinator() }

    func makeUIView(context: Context) -> WKWebView {
        let controller = WKUserContentController()
        controller.add(context.coordinator, name: "setting")
        let saved = UserDefaults.standard.dictionary(forKey: "bookState") as? [String: String] ?? [:]
        let encoded = (try? JSONSerialization.data(withJSONObject: saved)) ?? Data("{}".utf8)
        let json = String(data: encoded, encoding: .utf8) ?? "{}"
        controller.addUserScript(WKUserScript(
            source: "window.__nativeState = \(json);",
            injectionTime: .atDocumentStart,
            forMainFrameOnly: true
        ))

        let config = WKWebViewConfiguration()
        config.defaultWebpagePreferences.allowsContentJavaScript = true
        config.websiteDataStore = .default()
        config.userContentController = controller
        let webView = WKWebView(frame: .zero, configuration: config)
        webView.isOpaque = true
        webView.backgroundColor = .systemBackground
        webView.scrollView.bounces = false
        webView.scrollView.alwaysBounceHorizontal = false
        webView.scrollView.contentInsetAdjustmentBehavior = .never
        webView.navigationDelegate = context.coordinator
        context.coordinator.webView = webView

        if let folder = Bundle.main.url(forResource: "WebContent", withExtension: nil) {
            let index = folder.appendingPathComponent("index.html")
            context.coordinator.contentFolder = folder
            webView.loadFileURL(index, allowingReadAccessTo: folder)
        } else {
            webView.loadHTMLString("<h1>WebContent/index.html отсутствует в сборке</h1>", baseURL: nil)
        }
        return webView
    }

    func updateUIView(_ uiView: WKWebView, context: Context) {}

    final class Coordinator: NSObject, WKScriptMessageHandler, WKNavigationDelegate {
        var contentFolder: URL?
        weak var webView: WKWebView?

        override init() {
            super.init()
            NotificationCenter.default.addObserver(self, selector: #selector(saveReadingPosition),
                name: UIApplication.willResignActiveNotification, object: nil)
        }

        @objc private func saveReadingPosition() {
            webView?.evaluateJavaScript("window.bookSavePosition && window.bookSavePosition()", completionHandler: nil)
        }

        deinit { NotificationCenter.default.removeObserver(self) }

        func userContentController(_ userContentController: WKUserContentController,
                                   didReceive message: WKScriptMessage) {
            guard message.name == "setting",
                  let payload = message.body as? [String: String],
                  let key = payload["key"], let value = payload["value"],
                  key.hasPrefix("ya-"), key.count <= 150, value.count <= 1000 else { return }
            var state = UserDefaults.standard.dictionary(forKey: "bookState") as? [String: String] ?? [:]
            guard state.count < 3000 || state[key] != nil else { return }
            if key == "ya-theme" { UserDefaults.standard.set(value, forKey: "bookTheme") }
            state[key] = value
            UserDefaults.standard.set(state, forKey: "bookState")
        }

        func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction,
                     decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
            guard let url = navigationAction.request.url else {
                decisionHandler(.cancel)
                return
            }
            if url.isFileURL, let folder = contentFolder,
               url.standardizedFileURL.path.hasPrefix(folder.standardizedFileURL.path + "/") {
                decisionHandler(.allow)
            } else if ["https", "http"].contains(url.scheme?.lowercased() ?? "") {
                UIApplication.shared.open(url)
                decisionHandler(.cancel)
            } else {
                decisionHandler(.cancel)
            }
        }
    }
}
