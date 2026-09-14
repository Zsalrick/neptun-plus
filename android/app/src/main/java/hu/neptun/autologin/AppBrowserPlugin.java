package hu.neptun.autologin;

import android.content.Intent;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

// Opens the app's own Neptun browser (BrowserActivity) with a slim, app-themed chrome instead of the
// stock InAppBrowser toolbar. The web layer passes the login-injection script + user agent.
@CapacitorPlugin(name = "AppBrowser")
public class AppBrowserPlugin extends Plugin {
    @PluginMethod
    public void open(PluginCall call) {
        String url = call.getString("url", "");
        String script = call.getString("script", "");
        String ua = call.getString("ua", "");
        Intent i = new Intent(getContext(), BrowserActivity.class);
        i.putExtra("url", url);
        i.putExtra("script", script);
        i.putExtra("ua", ua);
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        getContext().startActivity(i);
        call.resolve();
    }
}
