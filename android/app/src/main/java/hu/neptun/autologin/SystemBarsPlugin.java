package hu.neptun.autologin;

import android.graphics.Color;
import android.os.Build;
import android.view.Window;

import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsControllerCompat;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

// A rendszer státusz- és navigációs sávjának ikonjai az APP TÉMÁJÁT kövessék, ne a telefon sötét módját.
// Világos témánál (Papír) sötét ikonok kellenek, különben a fehér óra és akku eltűnik a krémszínű háttéren.
// Android 15-től az app a sávok alá rajzol (edge-to-edge), ott csak az ikonok színe számít; régebbi
// Androidon a sáv háttérszínét is a téma hátteréhez igazítjuk.
@CapacitorPlugin(name = "SystemBars")
public class SystemBarsPlugin extends Plugin {
    @PluginMethod
    public void set(PluginCall call) {
        final boolean light = Boolean.TRUE.equals(call.getBoolean("light", false));
        final String color = call.getString("color", null);
        getActivity().runOnUiThread(() -> {
            try {
                Window w = getActivity().getWindow();
                WindowInsetsControllerCompat c = WindowCompat.getInsetsController(w, w.getDecorView());
                c.setAppearanceLightStatusBars(light);
                c.setAppearanceLightNavigationBars(light);
                if (color != null && Build.VERSION.SDK_INT < 35) {
                    int col = Color.parseColor(color);
                    w.setStatusBarColor(col);
                    w.setNavigationBarColor(col);
                }
                call.resolve();
            } catch (Exception e) {
                call.reject("SystemBars: " + e.getMessage());
            }
        });
    }
}
