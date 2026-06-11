self.addEventListener('push', (event) => {
  const data = event.data?.json() ?? {};
  const title = data.title || 'Kanbedu';
  const options = {
    body: data.body || '',
    icon: '/favicon.ico',
    tag: data.tag || 'kanbedu',
    data: { url: data.url || '/' },
    requireInteraction: false,
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if ('focus' in client) return client.focus();
        }
        return clients.openWindow('/');
      })
  );
});
