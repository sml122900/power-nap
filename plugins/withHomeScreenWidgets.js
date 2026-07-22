// 홈 화면 위젯 3종(S/M/L) — docs/decisions/home-screen-widgets-static-deeplink.md 참고.
//
// 헤드리스 JS 조사 결과(react-native-android-widget/registerWidgetTaskHandler) 프로세스
// 완전 종료 상태에서의 동작이 문서화돼 있지 않고, 삼성 One UI의 백그라운드 제한과 겹치는
// 미검증 리스크가 커서 이번엔 채택하지 않기로 확정했다. 위젯 내용 자체가 정적(잔여시간
// 표시·실시간 갱신 없음, 스코프 결정)이라 JS로 위젯을 렌더링할 이유도 없어, 서드파티
// 라이브러리 없이 바닐라 AppWidgetProvider + 딥링크만으로 구현한다:
//
//   위젯 버튼 탭 → PendingIntent(ACTION_VIEW, powernap:///?widgetMode=fast|slow|coffee)
//   → 앱이 이미 등록해 둔 scheme(app.json)으로 열림 → app/index.tsx의 widgetMode 훅이
//   기존 startFastSlow/커피냅 인라인 패널을 그대로 호출.
//
// 새 파일만 추가하는 방식이라(기존 라이브러리 소스 텍스트 패치 없음) withFullScreenAlarmIntent.js/
// withAlarmStopVibrationFix.js/withAlarmForegroundStartFix.js와 파일이 전혀 겹치지 않는다 —
// 앵커 매칭 실패 걱정 없이 plugins 배열 어디에 둬도 무방.
//
// 위젯 얼굴의 색은 src/theme.ts 토큰을 그대로 복사한 값이다(브랜드/앰버 팔레트가 바뀌면
// 이 파일의 드로어블 색상도 같이 갱신할 것 — RemoteViews는 JS 토큰을 참조할 수 없어 수동
// 동기화가 유일한 방법).

const { AndroidConfig, withAndroidManifest, withDangerousMod, createRunOncePlugin } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const WIDGET_PACKAGE_SUFFIX = 'widgets';
const PROVIDER_NAMES = {
  s: 'NapWidgetProviderS',
  m: 'NapWidgetProviderM',
  l: 'NapWidgetProviderL',
};

// theme.ts 팔레트 그대로 — 위 상단 주석 참고.
const COLOR = {
  brand: '#4353E0',
  surface: '#FFFFFF',
  line: '#DFE4EE',
  amberTint: '#FDF3E2',
  amberBorder: '#F0D3A4',
  ink: '#161D2E',
  inkSoft: '#5A6478',
  onDarkFaint: '#B8BEF5', // onDarkFaint(rgba(255,255,255,0.72))를 brand 채움 위 불투명 근사값으로.
};

function writeFile(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content);
}

// ---- drawable (버튼/셸 배경 — <shape> 기반, 밀도 무관) ----

function shapeDrawable({ solid, stroke, strokeWidthDp, radiusDp }) {
  const strokeXml = stroke ? `\n    <stroke android:width="${strokeWidthDp}dp" android:color="${stroke}" />` : '';
  return `<?xml version="1.0" encoding="utf-8"?>
<shape xmlns:android="http://schemas.android.com/apk/res/android" android:shape="rectangle">
    <solid android:color="${solid}" />
    <corners android:radius="${radiusDp}dp" />${strokeXml}
</shape>
`;
}

function writeDrawables(resDir) {
  writeFile(
    path.join(resDir, 'drawable', 'widget_shell_bg.xml'),
    shapeDrawable({ solid: COLOR.surface, radiusDp: 20 })
  );
  writeFile(
    path.join(resDir, 'drawable', 'widget_btn_primary_bg.xml'),
    shapeDrawable({ solid: COLOR.brand, radiusDp: 14 })
  );
  writeFile(
    path.join(resDir, 'drawable', 'widget_btn_secondary_bg.xml'),
    shapeDrawable({ solid: COLOR.surface, stroke: COLOR.line, strokeWidthDp: 1.4, radiusDp: 14 })
  );
  writeFile(
    path.join(resDir, 'drawable', 'widget_btn_coffee_bg.xml'),
    shapeDrawable({ solid: COLOR.amberTint, stroke: COLOR.amberBorder, strokeWidthDp: 1.4, radiusDp: 14 })
  );
}

// ---- layout (S/M/L) ----
// 버튼 내부는 title(굵게) + detail(작게, 정적 안내 문구 — 실시간 알람 시각 계산은
// JS(latency 설정)에 있어 네이티브 위젯 얼굴에서 그대로 보여줄 수 없다. 스코프 결정상
// "잔여시간 표시 없음"이라 숫자 없는 고정 안내 문구로 대체했다 — REVIEW_NEEDED 참고).

function napButton(id, bg, titleColor, detailColor, titleRes, detailRes, weightWrap, marginEndDp = 0) {
  const marginXml = marginEndDp ? `\n            android:layout_marginEnd="${marginEndDp}dp"` : '';
  return `        <LinearLayout
            android:id="@+id/${id}"
            android:layout_width="0dp"
            android:layout_height="match_parent"
            android:layout_weight="${weightWrap}"${marginXml}
            android:orientation="vertical"
            android:gravity="center_vertical"
            android:background="@drawable/${bg}"
            android:padding="10dp">
            <TextView
                android:layout_width="match_parent"
                android:layout_height="wrap_content"
                android:text="@string/${titleRes}"
                android:textColor="${titleColor}"
                android:textSize="13.5sp"
                android:textStyle="bold"
                android:maxLines="2" />
            <TextView
                android:layout_width="match_parent"
                android:layout_height="wrap_content"
                android:layout_marginTop="2dp"
                android:text="@string/${detailRes}"
                android:textColor="${detailColor}"
                android:textSize="11sp"
                android:maxLines="1" />
        </LinearLayout>
`;
}

const FAST_BTN = (id, weight, marginEndDp = 0) =>
  napButton(id, 'widget_btn_primary_bg', '#FFFFFF', COLOR.onDarkFaint, 'widget_fast_title', 'widget_tap_hint_nap', weight, marginEndDp);
const SLOW_BTN = (id, weight) =>
  napButton(id, 'widget_btn_secondary_bg', COLOR.ink, COLOR.inkSoft, 'widget_slow_title', 'widget_tap_hint_nap', weight);
const COFFEE_BTN = (id, weight) =>
  napButton(id, 'widget_btn_coffee_bg', COLOR.ink, COLOR.inkSoft, 'widget_coffee_title', 'widget_tap_hint_coffee', weight);

function shellLayout(innerXml, heightDp) {
  return `<?xml version="1.0" encoding="utf-8"?>
<LinearLayout xmlns:android="http://schemas.android.com/apk/res/android"
    android:layout_width="match_parent"
    android:layout_height="${heightDp}dp"
    android:orientation="vertical"
    android:background="@drawable/widget_shell_bg"
    android:padding="8dp">
${innerXml}</LinearLayout>
`;
}

function buildLayoutS() {
  const row = `    <LinearLayout
        android:layout_width="match_parent"
        android:layout_height="match_parent"
        android:orientation="horizontal">
${FAST_BTN('widget_btn_fast', 1)}    </LinearLayout>
`;
  return shellLayout(row, 94);
}

function buildLayoutM() {
  const row = `    <LinearLayout
        android:layout_width="match_parent"
        android:layout_height="match_parent"
        android:orientation="horizontal">
${FAST_BTN('widget_btn_fast', 1, 8)}${SLOW_BTN('widget_btn_slow', 1)}    </LinearLayout>
`;
  return shellLayout(row, 94);
}

function buildLayoutL() {
  // RemoteViews는 android.view.View를 인플레이트 못 한다("Class not allowed to be
  // inflated android.view.View", 실기기 확인) — 별도 spacer View 대신 버튼/행에
  // margin을 줘서 간격을 만든다.
  const topRow = `    <LinearLayout
        android:layout_width="match_parent"
        android:layout_height="0dp"
        android:layout_weight="1"
        android:layout_marginBottom="8dp"
        android:orientation="horizontal">
${FAST_BTN('widget_btn_fast', 1, 8)}${SLOW_BTN('widget_btn_slow', 1)}    </LinearLayout>
`;
  const coffeeRow = `    <LinearLayout
        android:layout_width="match_parent"
        android:layout_height="56dp"
        android:orientation="horizontal">
${COFFEE_BTN('widget_btn_coffee', 1)}    </LinearLayout>
`;
  return shellLayout(topRow + coffeeRow, 156);
}

// ---- widget_info (app-widget-provider 메타) ----

function widgetInfo({ minWidthDp, minHeightDp, cellW, cellH, layoutName }) {
  return `<?xml version="1.0" encoding="utf-8"?>
<appwidget-provider xmlns:android="http://schemas.android.com/apk/res/android"
    android:minWidth="${minWidthDp}dp"
    android:minHeight="${minHeightDp}dp"
    android:targetCellWidth="${cellW}"
    android:targetCellHeight="${cellH}"
    android:updatePeriodMillis="0"
    android:initialLayout="@layout/${layoutName}"
    android:resizeMode="none"
    android:widgetCategory="home_screen" />
`;
}

// ---- Kotlin (PendingIntent 헬퍼 + Provider 3종) ----

function buildKotlin(javaPackage) {
  return `package ${javaPackage}.${WIDGET_PACKAGE_SUFFIX}

import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.app.PendingIntent
import android.widget.RemoteViews
import ${javaPackage}.R

// PowerNap 홈 위젯(S/M/L) — 헤드리스 JS 없이 딥링크로만 앱을 연다(설계 결정,
// docs/decisions/home-screen-widgets-static-deeplink.md). 모드별 새 알람 예약 로직을
// 여기 만들지 않는다 — app/index.tsx의 widgetMode 훅이 기존 startFastSlow/커피냅 패널을
// 그대로 재사용한다(CLAUDE.md "같은 로직 두 곳에 독립적으로 두지 말 것").
internal object NapWidgetIntents {
    fun pendingIntentFor(context: Context, mode: String, requestCode: Int): PendingIntent {
        val intent = Intent(Intent.ACTION_VIEW, Uri.parse("powernap:///?widgetMode=\$mode"))
            .setPackage(context.packageName)
        return PendingIntent.getActivity(
            context,
            requestCode,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
    }
}

// requestCode를 위젯 인스턴스 id마다 다른 대역으로 나눠, 홈 화면에 같은 위젯을 여러 개
// 놓아도(드문 케이스지만) PendingIntent가 서로 덮어쓰지 않게 한다.
// public이어야 한다 — AndroidManifest가 참조하는 하위 클래스(NapWidgetProviderS 등)는
// 항상 기본 가시성(public)인데, Kotlin은 public 클래스가 internal 상위 타입을 노출하는
// 것을 금지한다(컴파일 에러, 실기기 빌드로 확인됨).
abstract class BaseNapWidgetProvider(
    private val layoutResId: Int,
    private val hasSlow: Boolean,
    private val hasCoffee: Boolean
) : AppWidgetProvider() {
    override fun onUpdate(context: Context, manager: AppWidgetManager, appWidgetIds: IntArray) {
        for (widgetId in appWidgetIds) {
            val views = RemoteViews(context.packageName, layoutResId)
            views.setOnClickPendingIntent(
                R.id.widget_btn_fast,
                NapWidgetIntents.pendingIntentFor(context, "fast", widgetId)
            )
            if (hasSlow) {
                views.setOnClickPendingIntent(
                    R.id.widget_btn_slow,
                    NapWidgetIntents.pendingIntentFor(context, "slow", widgetId + 10_000)
                )
            }
            if (hasCoffee) {
                views.setOnClickPendingIntent(
                    R.id.widget_btn_coffee,
                    NapWidgetIntents.pendingIntentFor(context, "coffee", widgetId + 20_000)
                )
            }
            manager.updateAppWidget(widgetId, views)
        }
    }
}

class ${PROVIDER_NAMES.s} : BaseNapWidgetProvider(R.layout.widget_s, hasSlow = false, hasCoffee = false)
class ${PROVIDER_NAMES.m} : BaseNapWidgetProvider(R.layout.widget_m, hasSlow = true, hasCoffee = false)
class ${PROVIDER_NAMES.l} : BaseNapWidgetProvider(R.layout.widget_l, hasSlow = true, hasCoffee = true)
`;
}

// ---- strings (values/ 영어 기본 + values-ko/ 한국어) ----

const STRINGS_EN = `<resources>
    <string name="widget_fast_title">I’ll fall asleep fast</string>
    <string name="widget_slow_title">I might toss and turn</string>
    <string name="widget_coffee_title">Coffee nap</string>
    <string name="widget_tap_hint_nap">Tap to set the alarm now</string>
    <string name="widget_tap_hint_coffee">Tap to enter when you had it</string>
    <string name="widget_label_s">PowerNap – Quick Nap</string>
    <string name="widget_label_m">PowerNap – Nap (2 modes)</string>
    <string name="widget_label_l">PowerNap – Nap (3 modes)</string>
</resources>
`;

const STRINGS_KO = `<resources>
    <string name="widget_fast_title">바로 잠들 것 같아요</string>
    <string name="widget_slow_title">좀 뒤척일 것 같아요</string>
    <string name="widget_coffee_title">커피냅</string>
    <string name="widget_tap_hint_nap">탭하면 지금 알람이 맞춰져요</string>
    <string name="widget_tap_hint_coffee">탭하면 마신 시각을 입력해요</string>
    <string name="widget_label_s">파워냅 – 바로 낮잠</string>
    <string name="widget_label_m">파워냅 – 낮잠 (2가지)</string>
    <string name="widget_label_l">파워냅 – 낮잠 (3가지)</string>
</resources>
`;

function withHomeScreenWidgetsFiles(config) {
  return withDangerousMod(config, [
    'android',
    async (config) => {
      const projectRoot = config.modRequest.projectRoot;
      const javaPackage = config.android.package;
      const packagePath = javaPackage.split('.').join(path.sep);
      const resDir = path.join(projectRoot, 'android/app/src/main/res');
      const javaDir = path.join(
        projectRoot,
        'android/app/src/main/java',
        packagePath,
        WIDGET_PACKAGE_SUFFIX
      );

      writeDrawables(resDir);

      writeFile(path.join(resDir, 'layout', 'widget_s.xml'), buildLayoutS());
      writeFile(path.join(resDir, 'layout', 'widget_m.xml'), buildLayoutM());
      writeFile(path.join(resDir, 'layout', 'widget_l.xml'), buildLayoutL());

      writeFile(
        path.join(resDir, 'xml', 'widget_info_s.xml'),
        widgetInfo({ minWidthDp: 180, minHeightDp: 110, cellW: 3, cellH: 2, layoutName: 'widget_s' })
      );
      writeFile(
        path.join(resDir, 'xml', 'widget_info_m.xml'),
        widgetInfo({ minWidthDp: 250, minHeightDp: 110, cellW: 4, cellH: 2, layoutName: 'widget_m' })
      );
      writeFile(
        path.join(resDir, 'xml', 'widget_info_l.xml'),
        widgetInfo({ minWidthDp: 250, minHeightDp: 180, cellW: 4, cellH: 3, layoutName: 'widget_l' })
      );

      writeFile(path.join(javaDir, 'NapWidgetProviders.kt'), buildKotlin(javaPackage));

      writeFile(path.join(resDir, 'values', 'widget_strings.xml'), STRINGS_EN);
      writeFile(path.join(resDir, 'values-ko', 'widget_strings.xml'), STRINGS_KO);

      return config;
    },
  ]);
}

function withHomeScreenWidgetsManifest(config) {
  return withAndroidManifest(config, (config) => {
    const app = AndroidConfig.Manifest.getMainApplicationOrThrow(config.modResults);
    const javaPackage = config.android.package;

    const receiverFor = (providerClass, widgetInfoResName, labelResName) => ({
      $: {
        'android:name': `${javaPackage}.${WIDGET_PACKAGE_SUFFIX}.${providerClass}`,
        'android:exported': 'true',
        'android:label': `@string/${labelResName}`,
      },
      'intent-filter': [
        {
          action: [{ $: { 'android:name': 'android.appwidget.action.APPWIDGET_UPDATE' } }],
        },
      ],
      'meta-data': [
        {
          $: {
            'android:name': 'android.appwidget.provider',
            'android:resource': `@xml/${widgetInfoResName}`,
          },
        },
      ],
    });

    if (!Array.isArray(app.receiver)) app.receiver = [];
    // 같은 이름의 receiver가 이미 있으면(prebuild 재실행) 지우고 새로 넣는다 — 멱등성.
    const ourNames = Object.values(PROVIDER_NAMES).map((name) => `${javaPackage}.${WIDGET_PACKAGE_SUFFIX}.${name}`);
    app.receiver = app.receiver.filter((r) => !ourNames.includes(r.$?.['android:name']));

    app.receiver.push(
      receiverFor(PROVIDER_NAMES.s, 'widget_info_s', 'widget_label_s'),
      receiverFor(PROVIDER_NAMES.m, 'widget_info_m', 'widget_label_m'),
      receiverFor(PROVIDER_NAMES.l, 'widget_info_l', 'widget_label_l')
    );

    return config;
  });
}

const withHomeScreenWidgets = (config) => {
  config = withHomeScreenWidgetsManifest(config);
  config = withHomeScreenWidgetsFiles(config);
  return config;
};

module.exports = createRunOncePlugin(withHomeScreenWidgets, 'powernap-home-screen-widgets', '1.0.0');
