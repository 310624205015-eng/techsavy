# Realtime Sync Implementation

## Overview
This implementation uses Supabase Realtime to automatically sync database changes to Google Sheets when registrations are updated directly in the database (outside the application).

## Features
- **Automatic Sync**: Listens for all registration changes (INSERT, UPDATE, DELETE)
- **Error Handling**: Robust error handling with retry logic
- **Resubscription**: Automatically resubscribes if connection is lost
- **Manual Sync**: Provides functions for manual sync operations
- **Testing**: Built-in test functionality

## Files Modified

### 1. `src/lib/realtime.ts`
- **setupRegistrationRealtimeSync()**: Sets up the Realtime subscription
- **teardownRegistrationRealtimeSync()**: Cleans up the subscription
- **handleRegistrationChange()**: Processes database changes and syncs to sheets
- **syncRegistrationManually()**: Manually sync a specific registration
- **syncEventRegistrations()**: Sync all registrations for an event
- **testRealtimeConnection()**: Test the Realtime connection

### 2. `src/server/middleware.ts`
- Added handling for sync actions from Realtime subscriptions
- Queries event data when syncing individual registrations
- Proper error handling for sync operations

### 3. `src/App.tsx`
- Added Realtime sync setup on app initialization
- Added cleanup on app unmount

## How It Works

1. **App Initialization**: When the app starts, it sets up a Realtime subscription to listen for registration changes
2. **Database Changes**: When a registration is inserted, updated, or deleted in the database, Supabase Realtime notifies the app
3. **Sync Process**: The app receives the change and calls the middleware to sync the updated data to Google Sheets
4. **Error Handling**: If the sync fails, it logs the error and can attempt to resubscribe if the connection is lost

## Usage

### Automatic Sync (Default)
The sync happens automatically when:
- A new registration is created
- An existing registration is updated
- A registration is deleted

### Manual Sync
```typescript
import { syncRegistrationManually, syncEventRegistrations } from './lib/realtime';

// Sync a specific registration
const registration = { id: '123', event_id: '456', /* ... */ };
await syncRegistrationManually(registration);

// Sync all registrations for an event
await syncEventRegistrations('event-123');
```

### Testing
```typescript
import { testRealtimeConnection } from './lib/realtime';

// Test the Realtime connection
const isConnected = await testRealtimeConnection();
console.log('Realtime connection:', isConnected ? 'Working' : 'Failed');
```

## Configuration

### Environment Variables
Make sure these are set in your `.env` file:
```
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_APPS_SCRIPT_URL=your_apps_script_url
```

### Database Setup
Ensure your database has:
1. **Realtime enabled** in Supabase dashboard
2. **RLP policies** that allow read access to the registrations table
3. **Proper triggers** for the registrations table (if using database triggers)

## Testing the Implementation

### 1. Test Realtime Connection
```typescript
// Open browser console and run:
import { testRealtimeConnection } from './src/lib/realtime';
testRealtimeConnection();
```

### 2. Manual Database Change Test
1. Go to Supabase dashboard
2. Navigate to your registrations table
3. Make a change (insert/update/delete a record)
4. Check the browser console for sync messages

### 3. Application Change Test
1. Make a registration through the web application
2. Check that it syncs to Google Sheets
3. Check the console for Realtime events

## Troubleshooting

### Common Issues

1. **No Realtime Events**
   - Check if Realtime is enabled in Supabase dashboard
   - Verify RLP policies allow read access
   - Check browser console for errors

2. **Sync Fails**
   - Verify the Apps Script URL is correct
   - Check network connectivity
   - Check browser console for error messages

3. **Connection Lost**
   - The system should automatically resubscribe
   - Check console for resubscription attempts
   - Verify network connectivity

### Debug Commands
```typescript
// Check current subscription status
console.log('Current subscription:', window.supabase.getChannels());

// Manually trigger a test event
// (You can do this by making a direct database change)

// Check if the middleware is receiving requests
// (Check browser network tab for requests to /api/sheets)
```

## Production Considerations

1. **Error Handling**: Add more robust error handling and retry logic
2. **Rate Limiting**: Consider adding rate limiting for sync operations
3. **Monitoring**: Add logging and monitoring for sync operations
4. **Security**: Ensure proper authentication and authorization
5. **Performance**: Consider batching multiple changes for better performance

## Future Enhancements

1. **Batch Processing**: Batch multiple registration changes for efficiency
2. **Queue System**: Implement a queue for failed sync operations
3. **Status Tracking**: Track sync status and provide feedback to users
4. **Webhook Integration**: Use webhooks instead of Realtime for some scenarios
5. **Caching**: Add caching to reduce database queries