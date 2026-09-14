package hu.neptun.autologin;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.widget.RemoteViews;

// Home-screen widget: a small swipeable deck showing the class happening now and/or the next one.
// The card content (and current/next selection) is computed in WidgetService from the cached schedule,
// so it stays correct between app runs.
public class NextClassWidget extends AppWidgetProvider {

    @Override
    public void onUpdate(Context ctx, AppWidgetManager mgr, int[] ids) {
        for (int id : ids) render(ctx, mgr, id);
    }

    // Called from WidgetPlugin when the app writes fresh data → repaint + reload every placed instance.
    static void pushUpdate(Context ctx) {
        AppWidgetManager mgr = AppWidgetManager.getInstance(ctx);
        int[] ids = mgr.getAppWidgetIds(new ComponentName(ctx, NextClassWidget.class));
        for (int id : ids) render(ctx, mgr, id);
    }

    static void render(Context ctx, AppWidgetManager mgr, int id) {
        RemoteViews v = new RemoteViews(ctx.getPackageName(), R.layout.widget_next_class);

        Intent svc = new Intent(ctx, WidgetService.class);
        svc.putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, id);
        svc.setData(Uri.parse(svc.toUri(Intent.URI_INTENT_SCHEME))); // unique per widget id
        v.setRemoteAdapter(R.id.w_stack, svc);
        v.setEmptyView(R.id.w_stack, R.id.w_empty);

        // Tap anywhere → open the app (collection needs a template + per-item fill-in intent).
        Intent open = ctx.getPackageManager().getLaunchIntentForPackage(ctx.getPackageName());
        if (open != null) {
            open.setAction(Intent.ACTION_MAIN);
            int flags = PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_MUTABLE;
            PendingIntent pi = PendingIntent.getActivity(ctx, 0, open, flags);
            v.setPendingIntentTemplate(R.id.w_stack, pi);
        }

        mgr.updateAppWidget(id, v);
        mgr.notifyAppWidgetViewDataChanged(id, R.id.w_stack);
    }
}
