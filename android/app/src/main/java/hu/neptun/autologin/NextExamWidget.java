package hu.neptun.autologin;

import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;

// "Következő számonkérés" home-screen widget. Drawing lives in WidgetRender (shared text layout).
public class NextExamWidget extends AppWidgetProvider {
    @Override
    public void onUpdate(Context ctx, AppWidgetManager mgr, int[] ids) {
        for (int id : ids) WidgetRender.renderExam(ctx, mgr, id);
    }
}
