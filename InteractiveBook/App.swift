import SwiftUI

@main
struct InteractiveBookApp: App {
    @AppStorage("bookTheme") private var theme = "light"

    init() {
        let saved = UserDefaults.standard.dictionary(forKey: "bookState") as? [String: String]
        UserDefaults.standard.set(saved?["ya-theme"] ?? "light", forKey: "bookTheme")
    }

    var body: some Scene {
        WindowGroup {
            BookView()
                .preferredColorScheme(theme == "dark" ? .dark : .light)
        }
    }
}
