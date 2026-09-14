package hu.neptun.autologin;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
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

// Slim single-card home-screen widget: the class happening now, or the next one. Recomputes current/next
// from the cached schedule on every tick (stays correct between app runs). The accent (label) colour
// follows the app's selected theme, passed in from the WebView.
public class NextClassWidget extends AppWidgetProvider {
    private static final Locale HU = new Locale("hu");

    @Override
    public void onUpdate(Context ctx, AppWidgetManager mgr, int[] ids) {
        for (int id : ids) render(ctx, mgr, id);
    }

    static void pushUpdate(Context ctx) {
        AppWidgetManager mgr = AppWidgetManager.getInstance(ctx);
        int[] ids = mgr.getAppWidgetIds(new ComponentName(ctx, NextClassWidget.class));
        for (int id : ids) render(ctx, mgr, id);
    }

    static void render(Context ctx, AppWidgetManager mgr, int id) {
        RemoteViews v = new RemoteViews(ctx.getPackageName(), R.layout.widget_next_class);
        String label = "", title = "Nincs közelgő óra", sub = "";
        int accent = 0xFFF5B221; // fallback gold
        try {
            SharedPreferences sp = ctx.getSharedPreferences(WidgetPlugin.PREFS, Context.MODE_PRIVATE);
            try { accent = Color.parseColor(sp.getString("accent", "#F5B221")); } catch (Exception ignore) {}
            JSONArray arr = new JSONArray(sp.getString("events", "[]"));
            long now = System.currentTimeMillis();
            JSONObject cur = null, next = null;
            for (int i = 0; i < arr.length(); i++) {
                JSONObject e = arr.getJSONObject(i);
                long s = e.optLong("s"), en = e.optLong("e");
                if (s <= now && en > now) { cur = e; break; }
                if (s > now && (next == null || s < next.optLong("s"))) next = e;
            }
            JSONObject e = cur != null ? cur : next;
            if (e != null) {
                label = cur != null ? "JELENLEGI ÓRA" : "KÖVETKEZŐ ÓRA";
                title = e.optString("n", "Óra");
                long s = e.optLong("s"), en = e.optLong("e");
                SimpleDateFormat hm = new SimpleDateFormat("HH:mm", HU);
                StringBuilder sb = new StringBuilder();
                if (cur == null) { String d = dayPrefix(s, now); if (!d.isEmpty()) sb.append(d).append(" · "); }
                sb.append(hm.format(s));
                if (en > 0) sb.append("–").append(hm.format(en));
                String t = e.optString("t", ""), r = e.optString("r", "");
                if (!t.isEmpty()) sb.append(" · ").append(t);
                if (!r.isEmpty()) sb.append(" · ").append(r);
                sub = sb.toString();
            }
        } catch (Exception ex) { /* default empty state */ }

        v.setTextViewText(R.id.w_label, label);
        v.setViewVisibility(R.id.w_label, label.isEmpty() ? View.GONE : View.VISIBLE);
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
