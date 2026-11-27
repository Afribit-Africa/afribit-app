package africa.afribit.network

import android.net.ConnectivityManager
import android.net.Network
import android.net.NetworkCapabilities
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.ByteArrayOutputStream
import java.net.Inet4Address
import java.net.URL
import javax.net.ssl.HttpsURLConnection

/**
 * Mesh probes bound to the Wi-Fi network (SH-11, S-14).
 *
 * Android sends traffic over mobile data when the Wi-Fi has no validated internet, which is
 * exactly the mesh-with-no-uplink case. The beacon must come from the gateway on the Wi-Fi,
 * so the request is opened on the Wi-Fi Network object itself instead of the default route.
 * HTTPS only, no redirects, no caches, and a hard size cap.
 */
class AfribitNetworkModule : Module() {
  private fun connectivity(): ConnectivityManager? =
    appContext.reactContext?.getSystemService(ConnectivityManager::class.java)

  @Suppress("DEPRECATION")
  private fun wifiNetwork(cm: ConnectivityManager): Network? =
    cm.allNetworks.firstOrNull { n ->
      cm.getNetworkCapabilities(n)?.hasTransport(NetworkCapabilities.TRANSPORT_WIFI) == true
    }

  override fun definition() = ModuleDefinition {
    Name("AfribitNetwork")

    /** This phone's IPv4 address on the Wi-Fi network, or null when not on Wi-Fi. */
    Function("wifiIpv4") {
      val cm = connectivity() ?: return@Function null
      val wifi = wifiNetwork(cm) ?: return@Function null
      cm.getLinkProperties(wifi)?.linkAddresses
        ?.map { it.address }
        ?.firstOrNull { it is Inet4Address && !it.isLoopbackAddress }
        ?.hostAddress
    }

    /** GET over the Wi-Fi network only. status 0 means not on Wi-Fi or the request failed. */
    AsyncFunction("wifiGet") { url: String, timeoutMs: Int, maxBytes: Int ->
      val none = mapOf("status" to 0, "body" to "", "onWifi" to false, "tooLarge" to false)
      val cm = connectivity() ?: return@AsyncFunction none
      val wifi = wifiNetwork(cm) ?: return@AsyncFunction none
      val target = URL(url)
      if (target.protocol != "https") throw IllegalArgumentException("https only")
      val conn = try {
        wifi.openConnection(target) as HttpsURLConnection
      } catch (e: Exception) {
        return@AsyncFunction none + ("onWifi" to true)
      }
      try {
        conn.connectTimeout = timeoutMs
        conn.readTimeout = timeoutMs
        conn.instanceFollowRedirects = false
        conn.useCaches = false
        val status = conn.responseCode
        val stream = if (status in 200..299) conn.inputStream else conn.errorStream
        val out = ByteArrayOutputStream()
        var tooLarge = false
        stream?.use { input ->
          val buf = ByteArray(1024)
          while (true) {
            val n = input.read(buf)
            if (n < 0) break
            if (out.size() + n > maxBytes) { tooLarge = true; break }
            out.write(buf, 0, n)
          }
        }
        mapOf(
          "status" to status,
          "body" to if (tooLarge) "" else out.toString(Charsets.UTF_8.name()),
          "onWifi" to true,
          "tooLarge" to tooLarge,
        )
      } catch (e: Exception) {
        none + ("onWifi" to true)
      } finally {
        conn.disconnect()
      }
    }
  }
}
