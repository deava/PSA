'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { AlertTriangleIcon, RefreshCwIcon } from 'lucide-react';

export default function EmergencyReset() {
  const [showReset, setShowReset] = useState(false);

  const resetApp = () => {
    // Clear any cached data
    localStorage.clear();
    sessionStorage.clear();
    
    // Reload the page
    window.location.reload();
  };

  return (
    <div className="fixed top-4 right-4 bg-amber-500/10 border border-yellow-200 rounded-lg p-4 max-w-sm text-sm">
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <AlertTriangleIcon className="h-4 w-4 text-yellow-600" />
          <span className="font-medium text-amber-400">Having Issues?</span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowReset(!showReset)}
          className="h-6 w-6 p-0"
        >
          {showReset ? '−' : '+'}
        </Button>
      </div>
      
      {showReset && (
        <div className="text-amber-400 space-y-2">
          <p className="text-xs">If you&apos;re experiencing issues after database setup:</p>
          <div className="space-y-1 text-xs">
            <p>1. Check console for specific errors</p>
            <p>2. Try refreshing the page</p>
            <p>3. If still broken, use emergency reset</p>
          </div>
          
          <Button
            onClick={resetApp}
            size="sm"
            variant="outline"
            className="text-xs mt-2"
          >
            <RefreshCwIcon className="h-3 w-3 mr-1" />
            Emergency Reset
          </Button>
        </div>
      )}
    </div>
  );
}
