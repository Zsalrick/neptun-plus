package hu.neptun.autologin;

import android.content.Context;
import android.content.SharedPreferences;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

// Bridges the WebView's schedule data to the native home-screen widget. The app writes the upcoming
// classes (as a JSON array of {s,e,n,t,r}); the widget picks current/next itself from the clock, so it
// stays correct between app runs. Stored in SharedPreferences the widget reads.
@CapacitorPlugin(name = "Widget")
public class WidgetPlugin extends Plugin {
    static final String PREFS = "neptunplus_widget";

    @PluginMethod
    public void setClasses(PluginCall call) {
        Context ctx = getContext();
        SharedPreferences sp = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        sp.edit()
            .putString("events", call.getString("events", "[]"))
            .putString("accent", call.getString("accent", "#F5B221"))
            .apply();
        NextClassWidget.pushUpdate(ctx);
        call.resolve();
    }
}
