interface BrowserConnectionInfo {
  downlink?: number;
  effectiveType?: string;
  rtt?: number;
  saveData?: boolean;
  type?: string;
}

interface NavigatorWithConnection extends Navigator {
  connection?: BrowserConnectionInfo;
  mozConnection?: BrowserConnectionInfo;
  webkitConnection?: BrowserConnectionInfo;
}

interface BrowserPositionSnapshot {
  accuracy: number;
  latitude: number;
  longitude: number;
  timestamp: string;
}

function getBrowserNavigator() {
  if (typeof navigator === 'undefined') {
    throw new Error('Browser navigator APIs are unavailable in this environment.');
  }

  return navigator;
}

function formatOffsetSegment(value: number) {
  return String(value).padStart(2, '0');
}

export function formatCoordinate(value: number) {
  return value.toFixed(4);
}

export function formatUtcOffset(totalMinutes: number) {
  const sign = totalMinutes >= 0 ? '+' : '-';
  const absoluteMinutes = Math.abs(totalMinutes);
  const hours = Math.floor(absoluteMinutes / 60);
  const minutes = absoluteMinutes % 60;
  return `UTC${sign}${formatOffsetSegment(hours)}:${formatOffsetSegment(minutes)}`;
}

export function getCurrentPosition(options: PositionOptions = {}) {
  const browserNavigator = getBrowserNavigator();
  if (!browserNavigator.geolocation) {
    throw new Error('Browser geolocation is unavailable on this device.');
  }

  return new Promise<BrowserPositionSnapshot>((resolve, reject) => {
    browserNavigator.geolocation.getCurrentPosition(
      (position) =>
        resolve({
          accuracy: position.coords.accuracy,
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          timestamp: new Date(position.timestamp).toISOString(),
        }),
      (error) => {
        if (error.code === error.PERMISSION_DENIED) {
          reject(new Error('Location permission was denied.'));
          return;
        }

        if (error.code === error.TIMEOUT) {
          reject(new Error('Current location request timed out.'));
          return;
        }

        reject(new Error('Current location is unavailable.'));
      },
      {
        enableHighAccuracy: false,
        maximumAge: 0,
        timeout: 10000,
        ...options,
      },
    );
  });
}

export function getCurrentDateTimeSnapshot(now = new Date()) {
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

  return {
    isoTimestamp: now.toISOString(),
    localDate: new Intl.DateTimeFormat(undefined, {
      dateStyle: 'full',
    }).format(now),
    localTime: new Intl.DateTimeFormat(undefined, {
      timeStyle: 'medium',
    }).format(now),
    weekday: new Intl.DateTimeFormat(undefined, {
      weekday: 'long',
    }).format(now),
    timezone,
  };
}

export function getCurrentTimezoneSnapshot(now = new Date()) {
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  const utcOffsetMinutes = -now.getTimezoneOffset();
  const utcOffsetLabel = formatUtcOffset(utcOffsetMinutes);

  return {
    timezone,
    utcOffsetMinutes,
    utcOffsetLabel,
    displayLabel: `${timezone} (${utcOffsetLabel})`,
  };
}

export function getCurrentLocaleSnapshot() {
  const browserNavigator = getBrowserNavigator();
  const languages = Array.isArray(browserNavigator.languages) ? browserNavigator.languages.filter(Boolean) : [];
  const locale = browserNavigator.language || languages[0] || Intl.DateTimeFormat().resolvedOptions().locale || 'unknown';

  return {
    locale,
    languages,
  };
}

export function getOnlineStatusSnapshot() {
  const browserNavigator = getBrowserNavigator() as NavigatorWithConnection;
  const connection = browserNavigator.connection ?? browserNavigator.mozConnection ?? browserNavigator.webkitConnection;

  return {
    online: browserNavigator.onLine,
    connection: connection
      ? {
          downlink: connection.downlink,
          effectiveType: connection.effectiveType,
          rtt: connection.rtt,
          saveData: connection.saveData,
          type: connection.type,
        }
      : undefined,
  };
}
