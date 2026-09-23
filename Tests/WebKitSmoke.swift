import Cocoa
import WebKit

// Standalone WebKit integration checks. Runs with isolated storage, not the user's app data.
final class Runner: NSObject, WKNavigationDelegate, WKScriptMessageHandler {
    var web: WKWebView!
    var window: NSWindow!
    var phase = 0
    var state: [String:String] = [:]
    let root: URL
    init(root: URL) { self.root = root; super.init() }
    func start() {
        let config = WKWebViewConfiguration()
        config.websiteDataStore = .nonPersistent()
        config.userContentController.add(self, name: "setting")
        config.userContentController.add(self, name: "result")
        web = WKWebView(frame: NSRect(x:0,y:0,width:Double(CommandLine.arguments.count > 3 ? CommandLine.arguments[3] : "390") ?? 390,height:Double(CommandLine.arguments.count > 4 ? CommandLine.arguments[4] : "760") ?? 760), configuration:config)
        web.navigationDelegate = self
        window = NSWindow(contentRect: web.frame, styleMask: [.titled], backing:.buffered, defer:false)
        window.contentView = web
        window.title = "Проверка учебника WebKit"
        window.makeKeyAndOrderFront(nil)
        NSApp.activate(ignoringOtherApps: true)
        web.loadFileURL(root.appendingPathComponent("index.html"), allowingReadAccessTo:root)
        DispatchQueue.main.asyncAfter(deadline:.now()+60) { print("FAIL: timeout"); exit(1) }
    }
    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        print("Loaded test phase \(phase)")
        let path = CommandLine.arguments[2] + (phase == 0 ? "/reader.test.js" : "/restore.test.js")
        do { let js = try String(contentsOfFile:path, encoding:.utf8)
            web.evaluateJavaScript("void " + js) { _, error in if let error = error { print(error); exit(1) } }
        } catch { print(error); exit(1) }
    }
    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        if message.name == "setting", let p = message.body as? [String:String], let k=p["key"],let v=p["value"] { state[k]=v; return }
        guard let result=message.body as? [String:Any] else { return }
        print(result)
        if result["ok"] as? Bool != true { exit(1) }
        if phase == 0 {
            guard state["ya-reading"] != nil, state["ya-done-t-10-9"] == "1" else { print("FAIL: native bridge did not receive state");exit(1) }
            let json = String(data:try! JSONSerialization.data(withJSONObject:state),encoding:.utf8)!
            web.configuration.userContentController.addUserScript(WKUserScript(source:"window.__nativeState = \(json);",injectionTime:.atDocumentStart,forMainFrameOnly:true))
            phase=1
            web.reload()
        } else { print("PASS: WebKit integration and native-state restoration");exit(0) }
    }
}
let app = NSApplication.shared
app.setActivationPolicy(.regular)
let runner = Runner(root:URL(fileURLWithPath:CommandLine.arguments[1]))
runner.start()
app.run()
