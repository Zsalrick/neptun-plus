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

    // Repaint every placed instance of all widgets (called when the app writes fresh data).
    static void pushAll(Context ctx) {
        AppWidgetManager mgr = AppWidgetManager.getInstance(ctx);
        renderAll(ctx, mgr, CurrentClassWidget.class, true);
        renderAll(ctx, mgr, NextClassWidget.class, false);
        renderAllStat(ctx, mgr, GradesWidget.class, "credit");
        renderAllStat(ctx, mgr, FinanceWidget.class, "balance");
        renderAllStat(ctx, mgr, TodayWidget.class, "today");
        renderAllExam(ctx, mgr);
    }

    static void renderAll(Context ctx, AppWidgetManager mgr, Class<?> cls, boolean currentMode) {
        int[] ids = mgr.getAppWidgetIds(new ComponentName(ctx, cls));
        for (int id : ids) render(ctx, mgr, id, currentMode);
    }

    static void renderAllStat(Context ctx, AppWidgetManager mgr, Class<?> cls, String kind) {
        int[] ids = mgr.getAppWidgetIds(new ComponentName(ctx, cls));
        for (int id : ids) renderStat(ctx, mgr, id, kind);
    }

    static void renderAllExam(Context ctx, AppWidgetManager mgr) {
        int[] ids = mgr.getAppWidgetIds(new ComponentName(ctx, NextExamWidget.class));
        for (int id : ids) renderExam(ctx, mgr, id);
    }

    static void render(Context ctx, AppWidgetManager mgr, int id, boolean currentMode) {
        RemoteViews v = new RemoteViews(ctx.getPackageName(), R.layout.widget_next_class);
        String label = currentMode ? "Most tart" : "Következő óra";
        String title = currentMode ? "Most nincs órád" : "Nincs közelgő óra";
        String sub = "", big = "", bigSub = "";
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
                // Big column: start time, end time under it. The day goes into the label ("Következő óra · kedd").
                big = hm.format(s);
                if (en > 0) bigSub = hm.format(en);
                if (!currentMode) { String d = dayPrefix(s, now); if (!d.isEmpty()) label = label + " · " + d; }
                StringBuilder sb = new StringBuilder();
                String t = pick.optString("t", ""), r = pick.optString("r", "");
                if (!t.isEmpty()) sb.append(t);
                if (!r.isEmpty()) { if (sb.length() > 0) sb.append(" · "); sb.append(r); }
                sub = sb.toString();
            }
        } catch (Exception ex) { /* default empty state */ }

        v.setTextViewText(R.id.w_label, label);
        v.setTextColor(R.id.w_label, accent);
        v.setTextViewText(R.id.w_title, title);
        v.setTextViewText(R.id.w_sub, sub);
        v.setViewVisibility(R.id.w_sub, sub.isEmpty() ? View.GONE : View.VISIBLE);
        setBig(v, big, bigSub);

        setOpen(ctx, v);
        mgr.updateAppWidget(id, v);
    }

    // Big-figure stat widget (Kreditindex / Egyenleg / Mai órák). Data comes from the "stats" JSON the app writes.
    static void renderStat(Context ctx, AppWidgetManager mgr, int id, String kind) {
        RemoteViews v = new RemoteViews(ctx.getPackageName(), R.layout.widget_stat);
        int accent = 0xFFF5B221;
        String label = defaultStatLabel(kind), val = "-", sub = "";
        try {
            SharedPreferences sp = ctx.getSharedPreferences(WidgetPlugin.PREFS, Context.MODE_PRIVATE);
            try { accent = Color.parseColor(sp.getString("accent", "#F5B221")); } catch (Exception ignore) {}
            JSONObject o = new JSONObject(sp.getString("stats", "{}")).optJSONObject(kind);
            if (o != null) {
                label = o.optString("l", label);
                val = o.optString("v", "-");
                sub = o.optString("s", "");
            }
        } catch (Exception ex) { /* default empty state */ }
        v.setTextViewText(R.id.w_label, label);
        v.setTextColor(R.id.w_label, accent);
        v.setTextViewText(R.id.w_val, val);
        v.setTextViewText(R.id.w_sub, sub);
        v.setViewVisibility(R.id.w_sub, sub.isEmpty() ? View.GONE : View.VISIBLE);
        setOpen(ctx, v);
        mgr.updateAppWidget(id, v);
    }

    // Next-assessment widget: reuses the text layout (label / title / sub).
    static void renderExam(Context ctx, AppWidgetManager mgr, int id) {
        RemoteViews v = new RemoteViews(ctx.getPackageName(), R.layout.widget_next_class);
        int accent = 0xFFF5B221;
        String label = "Következő számonkérés", title = "Nincs közelgő", sub = "", big = "", bigSub = "";
        try {
            SharedPreferences sp = ctx.getSharedPreferences(WidgetPlugin.PREFS, Context.MODE_PRIVATE);
            try { accent = Color.parseColor(sp.getString("accent", "#F5B221")); } catch (Exception ignore) {}
            JSONObject o = new JSONObject(sp.getString("stats", "{}")).optJSONObject("exam");
            if (o != null) {
                label = o.optString("l", label);
                title = o.optString("t", title);
                sub = o.optString("s", "");
                big = o.optString("b", "");      // "12" / "Ma" / "Holnap" (newer app versions)
                bigSub = o.optString("bs", "");  // "nap múlva" / "16:00"
            }
        } catch (Exception ex) { /* default empty state */ }
        v.setTextViewText(R.id.w_label, label);
        v.setTextColor(R.id.w_label, accent);
        v.setTextViewText(R.id.w_title, title);
        v.setTextViewText(R.id.w_sub, sub);
        v.setViewVisibility(R.id.w_sub, sub.isEmpty() ? View.GONE : View.VISIBLE);
        setBig(v, big, bigSub);
        setOpen(ctx, v);
        mgr.updateAppWidget(id, v);
    }

    // The big left column (time / days). Hidden when there is nothing to show, so the title takes the width.
    private static void setBig(RemoteViews v, String big, String bigSub) {
        int vis = big.isEmpty() ? View.GONE : View.VISIBLE;
        v.setViewVisibility(R.id.w_timecol, vis);
        v.setViewVisibility(R.id.w_div, vis);
        v.setTextViewText(R.id.w_big, big);
        v.setTextViewText(R.id.w_bigsub, bigSub);
        v.setViewVisibility(R.id.w_bigsub, bigSub.isEmpty() ? View.GONE : View.VISIBLE);
    }

    private static String defaultStatLabel(String kind) {
        if ("balance".equals(kind)) return "Egyenleg";
        if ("today".equals(kind)) return "Mai órák";
        return "Kreditindex";
    }

    // Tapping any widget opens the app.
    private static void setOpen(Context ctx, RemoteViews v) {
        Intent open = ctx.getPackageManager().getLaunchIntentForPackage(ctx.getPackageName());
        if (open != null) {
            int flags = PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE;
            v.setOnClickPendingIntent(R.id.w_root, PendingIntent.getActivity(ctx, 0, open, flags));
        }
    }

    private static String dayPrefix(long ts, long now) {
        Calendar a = Calendar.getInstance(); a.setTimeInMillis(ts);
        Calendar b = Calendar.getInstance(); b.setTimeInMillis(now);
        if (a.get(Calendar.YEAR) == b.get(Calendar.YEAR) && a.get(Calendar.DAY_OF_YEAR) == b.get(Calendar.DAY_OF_YEAR)) return "";
        Calendar t = (Calendar) b.clone(); t.add(Calendar.DAY_OF_YEAR, 1);
        if (a.get(Calendar.YEAR) == t.get(Calendar.YEAR) && a.get(Calendar.DAY_OF_YEAR) == t.get(Calendar.DAY_OF_YEAR)) return "holnap";
        return new SimpleDateFormat("EEEE", HU).format(ts); // "kedd"
    }
}
