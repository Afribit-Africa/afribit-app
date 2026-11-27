import ExpoModulesCore

/// iOS has no per-request network binding for this case; the shell falls back to fetch,
/// which iOS sends over the associated Wi-Fi. `unsupported` tells the caller to do that.
public class AfribitNetworkModule: Module {
  public func definition() -> ModuleDefinition {
    Name("AfribitNetwork")

    Function("wifiIpv4") { () -> String? in
      nil
    }

    AsyncFunction("wifiGet") { (_ url: String, _ timeoutMs: Int, _ maxBytes: Int) -> [String: Any] in
      ["status": 0, "body": "", "onWifi": false, "tooLarge": false, "unsupported": true]
    }
  }
}
