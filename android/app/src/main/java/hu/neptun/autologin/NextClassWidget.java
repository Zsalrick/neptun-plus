package hu.neptun.autologin;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.view.View;
import android.widget.RemoteViews;

import org.json.JSONArray;
import org.json.JSONObject;

import java.text.SimpleDateFormat;
import java.util.Calendar;
import java.util.Locale;

// Home-screen widget: shows the class happening now, or the next one. It recomputes current/next from
// the cached upcoming-class list on every update tick, so it stays correct without opening the app.
public class NextClassWidget extends AppWidgetProvider {
    private static final Locale HU = new Locale("hu");

    @Override
    public void onUpdate(Context ctx, AppWidgetManager mgr, int[] ids) {
        for (int id : ids) render(ctx, mgr, id);
    }

    // Called from WidgetPlugin when the app writes fresh data → repaint every placed widget instance.
    static void pushUpdate(Context ctx) {
        AppWidgetManager mgr = AppWidgetManager.getInstance(ctx);
        int[] ids = mgr.getAppWidgetIds(new ComponentName(ctx, NextClassWidget.class));
        for (int id : ids) render(ctx, mgr, id);
    }

    static void render(Context ctx, AppWidgetManager mgr, int id) {
        RemoteViews v = new RemoteViews(ctx.getPackageName(), R.layout.widget_next_class);
        String label = "", title = "Nincs közelgő óra", sub = "";
        try {
            SharedPreferences sp = ctx.getSharedPreferences(WidgetPlugin.PREFS, Context.MODE_PRIVATE);
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
                String time = hm.format(s) + (en > 0 ? "–" + hm.format(en) : "");
                String day = cur != null ? "" : dayPrefix(s, now);
                StringBuilder sb = new StringBuilder();
                if (!day.isEmpty()) sb.append(day).append(" · ");
                sb.append(time);
                String type = e.optString("t", ""), room = e.optString("r", "");
                if (!type.isEmpty()) sb.append(" · ").append(type);
                if (!room.isEmpty()) sb.append(" · ").append(room);
                sub = sb.toString();
            }
        } catch (Exception ex) { /* show the default empty state */ }

        v.setTextViewText(R.id.w_label, label);
        v.setViewVisibility(R.id.w_label, label.isEmpty() ? View.GONE : View.VISIBLE);
        v.setTextViewText(R.id.w_title, title);
        v.setTextViewText(R.id.w_sub, sub);
        v.setViewVisibility(R.id.w_sub, sub.isEmpty() ? View.GONE : View.VISIBLE);

        Intent open = ctx.getPackageManager().getLaunchIntentForPackage(ctx.getPackageName());
        int flags = PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE;
        if (open != null) {
            PendingIntent pi = PendingIntent.getActivity(ctx, 0, open, flags);
            v.setOnClickPendingIntent(R.id.w_root, pi);
        }
        mgr.updateAppWidget(id, v);
    }

    // "" if same calendar day as now, else a short Hungarian weekday (e.g. " Hét", "Kedd").
    private static String dayPrefix(long ts, long now) {
        Calendar a = Calendar.getInstance(); a.setTimeInMillis(ts);
        Calendar b = Calendar.getInstance(); b.setTimeInMillis(now);
        if (a.get(Calendar.YEAR) == b.get(Calendar.YEAR) && a.get(Calendar.DAY_OF_YEAR) == b.get(Calendar.DAY_OF_YEAR)) return "";
        return new SimpleDateFormat("EEE", HU).format(ts);
    }
}
