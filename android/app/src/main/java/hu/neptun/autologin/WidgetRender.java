package hu.neptun.autologin;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.view.View;
import android.widget.RemoteViews;

import org.json.JSONArray;
import org.json.JSONObject;

import java.text.SimpleDateFormat;
import java.util.Calendar;
import java.util.Locale;

// Shared drawing for the two home-screen widgets (Jelenlegi óra / Következő óra). Each picks its class
// from the cached schedule against the clock, so they stay correct between app runs. The accent (label)
// colour follows the app's selected theme, passed in from the WebView.
class WidgetRender {
    private static final Locale HU = new Locale("hu");

    // Repaint every placed instance of both widgets (called when the app writes fresh data).
    static void pushAll(Context ctx) {
        AppWidgetManager mgr = AppWidgetManager.getInstance(ctx);
        renderAll(ctx, mgr, CurrentClassWidget.class, true);
        renderAll(ctx, mgr, NextClassWidget.class, false);
    }

    static void renderAll(Context ctx, AppWidgetManager mgr, Class<?> cls, boolean currentMode) {
        int[] ids = mgr.getAppWidgetIds(new ComponentName(ctx, cls));
        for (int id : ids) render(ctx, mgr, id, currentMode);
    }

    static void render(Context ctx, AppWidgetManager mgr, int id, boolean currentMode) {
        RemoteViews v = new RemoteViews(ctx.getPackageName(), R.layout.widget_next_class);
        String label = currentMode ? "JELENLEGI ÓRA" : "KÖVETKEZŐ ÓRA";
        String title = currentMode ? "Nincs most órád" : "Nincs közelgő óra";
        String sub = "";
        int accent = 0xFFF5B221;
        try {
            SharedPreferences sp = ctx.getSharedPreferences(WidgetPlugin.PREFS, Context.MODE_PRIVATE);
            try { accent = Color.parseColor(sp.getString("accent", "#F5B221")); } catch (Exception ignore) {}
            JSONArray arr = new JSONArray(sp.getString("events", "[]"));
            long now = System.currentTimeMillis();
            JSONObject pick = null;
            for (int i = 0; i < arr.length(); i++) {
                JSONObject e = arr.getJSONObject(i);
                long s = e.optLong("s"), en = e.optLong("e");
                if (currentMode) {
                    if (s <= now && en > now) { pick = e; break; }
                } else {
                    if (s > now && (pick == null || s < pick.optLong("s"))) pick = e;
                }
            }
            if (pick != null) {
                title = pick.optString("n", "Óra");
                long s = pick.optLong("s"), en = pick.optLong("e");
                SimpleDateFormat hm = new SimpleDateFormat("HH:mm", HU);
                StringBuilder sb = new StringBuilder();
                if (!currentMode) { String d = dayPrefix(s, now); if (!d.isEmpty()) sb.append(d).append(" · "); }
                sb.append(hm.format(s));
                if (en > 0) sb.append("–").append(hm.format(en));
                String t = pick.optString("t", ""), r = pick.optString("r", "");
                if (!t.isEmpty()) sb.append(" · ").append(t);
                if (!r.isEmpty()) sb.append(" · ").append(r);
                sub = sb.toString();
            }
        } catch (Exception ex) { /* default empty state */ }

        v.setTextViewText(R.id.w_label, label);
        v.setTextColor(R.id.w_label, accent);
        v.setTextViewText(R.id.w_title, title);
        v.setTextViewText(R.id.w_sub, sub);
        v.setViewVisibility(R.id.w_sub, sub.isEmpty() ? View.GONE : View.VISIBLE);

        Intent open = ctx.getPackageManager().getLaunchIntentForPackage(ctx.getPackageName());
        if (open != null) {
            int flags = PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE;
            v.setOnClickPendingIntent(R.id.w_root, PendingIntent.getActivity(ctx, 0, open, flags));
        }
        mgr.updateAppWidget(id, v);
    }

    private static String dayPrefix(long ts, long now) {
        Calendar a = Calendar.getInstance(); a.setTimeInMillis(ts);
        Calendar b = Calendar.getInstance(); b.setTimeInMillis(now);
        if (a.get(Calendar.YEAR) == b.get(Calendar.YEAR) && a.get(Calendar.DAY_OF_YEAR) == b.get(Calendar.DAY_OF_YEAR)) return "";
        return new SimpleDateFormat("EEE", HU).format(ts);
    }
}
