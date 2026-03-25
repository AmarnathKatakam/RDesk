import React, { useEffect, useMemo, useRef, useState } from 'react';
import { MapPin, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { attendanceAPI } from '@/services/api';

export type WorkType = 'WFO' | 'WFH' | 'ON_SITE';

interface PunchCoordinates {
  latitude: number;
  longitude: number;
  accuracy?: number;
}

interface OfficeLocation {
  id?: number;
  name?: string;
  latitude: number;
  longitude: number;
  allowed_radius_meters?: number;
  is_default?: boolean;
  is_active?: boolean;
}

interface UsePunchInFlowOptions {
  employeeId?: string;
  onSuccess: (message: string) => Promise<void> | void;
  onError: (message: string) => void;
}

interface CachedPunchPreference {
  date: string;
  workType: WorkType;
}

const DEFAULT_RADIUS_METERS = 100;

const getLocalDateKey = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getPreferenceKey = (employeeId?: string) =>
  `rd_punch_pref_${employeeId || 'employee'}`;

const readPreference = (employeeId?: string): CachedPunchPreference | null => {
  try {
    const rawValue = localStorage.getItem(getPreferenceKey(employeeId));
    if (!rawValue) return null;
    return JSON.parse(rawValue) as CachedPunchPreference;
  } catch (error) {
    return null;
  }
};

const writePreference = (employeeId: string | undefined, workType: WorkType) => {
  localStorage.setItem(
    getPreferenceKey(employeeId),
    JSON.stringify({
      date: getLocalDateKey(),
      workType,
    })
  );
};

const toRadians = (value: number) => (value * Math.PI) / 180;

const getDistanceMeters = (
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
) => {
  const earthRadius = 6371000;
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLng / 2) ** 2;

  return 2 * earthRadius * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const parseOfficeLocations = (payload: any): OfficeLocation[] => {
  const candidates = [
    payload,
    payload?.results,
    payload?.data,
    payload?.locations,
    payload?.office_locations,
  ];

  const records = candidates.find((candidate) => Array.isArray(candidate));
  if (!Array.isArray(records)) {
    return [];
  }

  return records
    .map((record) => ({
      id: Number(record?.id),
      name: record?.name,
      latitude: Number(record?.latitude),
      longitude: Number(record?.longitude),
      allowed_radius_meters: Number(record?.allowed_radius_meters || record?.radius || DEFAULT_RADIUS_METERS),
      is_default: Boolean(record?.is_default),
      is_active: record?.is_active !== false,
    }))
    .filter(
      (record) =>
        Number.isFinite(record.latitude) &&
        Number.isFinite(record.longitude) &&
        record.is_active
    );
};

const getCoordinates = (): Promise<PunchCoordinates> =>
  new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(
        new Error('Location is unavailable in this browser. You can still continue with WFH or On-site.')
      );
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) =>
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
        }),
      (geoError) => {
        if (geoError.code === geoError.PERMISSION_DENIED) {
          reject(
            new Error('Location permission denied. You can continue manually, but office verification may be unavailable.')
          );
        } else if (geoError.code === geoError.TIMEOUT) {
          reject(new Error('Location request timed out. You can continue manually if needed.'));
        } else {
          reject(new Error('Unable to fetch your location right now. You can continue manually if needed.'));
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0,
      }
    );
  });

export const usePunchInFlow = ({
  employeeId,
  onSuccess,
  onError,
}: UsePunchInFlowOptions) => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [coords, setCoords] = useState<PunchCoordinates | null>(null);
  const [selectedWorkType, setSelectedWorkType] = useState<WorkType>('WFH');
  const [suggestedWorkType, setSuggestedWorkType] = useState<WorkType | null>(null);
  const [helperText, setHelperText] = useState('');
  const [locationMessage, setLocationMessage] = useState('');
  const [officeLocation, setOfficeLocation] = useState<OfficeLocation | null>(null);
  const [loadingOffice, setLoadingOffice] = useState(true);
  const inFlightRef = useRef(false);

  useEffect(() => {
    const loadOfficeLocation = async () => {
      try {
        const response = await attendanceAPI.getOfficeLocations();
        const locations = parseOfficeLocations(response.data);
        const preferredLocation =
          locations.find((location) => location.is_default) ||
          locations[0] ||
          null;
        setOfficeLocation(preferredLocation);
      } catch (error) {
        setOfficeLocation(null);
      } finally {
        setLoadingOffice(false);
      }
    };

    void loadOfficeLocation();
  }, []);

  const todayPreference = useMemo(() => {
    const preference = readPreference(employeeId);
    return preference?.date === getLocalDateKey() ? preference : null;
  }, [employeeId, dialogOpen]);

  const beginPunchIn = async () => {
    if (inFlightRef.current || submitting) return;

    inFlightRef.current = true;

    try {
      let nextCoords: PunchCoordinates | null = null;
      let nextMessage = '';

      try {
        nextCoords = await getCoordinates();
      } catch (error: any) {
        nextMessage = error?.message || 'Location could not be fetched.';
      }

      let nextWorkType: WorkType = todayPreference?.workType || 'WFH';
      let nextSuggestedWorkType: WorkType | null = null;
      let nextHelperText = 'Choose how you are working today.';

      if (nextCoords && officeLocation) {
        const radius = officeLocation.allowed_radius_meters || DEFAULT_RADIUS_METERS;
        const distance = getDistanceMeters(
          nextCoords.latitude,
          nextCoords.longitude,
          officeLocation.latitude,
          officeLocation.longitude
        );

        if (distance <= radius) {
          nextSuggestedWorkType = 'WFO';
          nextWorkType = todayPreference?.workType || 'WFO';
          nextHelperText = `You seem to be at ${officeLocation.name || 'office'}. Confirm Work From Office?`;
        } else {
          nextWorkType = todayPreference?.workType || 'WFH';
          nextHelperText = 'You appear to be outside the office geofence. Choose WFH or On-site if needed.';
        }
      } else if (todayPreference?.workType) {
        nextHelperText = `Using your saved work preference for today: ${todayPreference.workType}. You can still change it.`;
      } else if (!loadingOffice && !officeLocation) {
        nextHelperText = 'Office geofence is unavailable, so please choose your work type manually.';
      }

      setCoords(nextCoords);
      setLocationMessage(nextMessage);
      setSuggestedWorkType(nextSuggestedWorkType);
      setSelectedWorkType(nextWorkType);
      setHelperText(nextHelperText);
      setDialogOpen(true);
    } catch (error: any) {
      onError(error?.message || 'Unable to start punch in.');
    } finally {
      inFlightRef.current = false;
    }
  };

  const confirmPunchIn = async () => {
    try {
      setSubmitting(true);

      await attendanceAPI.punchIn({
        employee_id: employeeId,
        latitude: coords?.latitude,
        longitude: coords?.longitude,
        workType: selectedWorkType,
      });

      writePreference(employeeId, selectedWorkType);
      setDialogOpen(false);
      await onSuccess(`Punch in recorded successfully as ${selectedWorkType}.`);
    } catch (error: any) {
      onError(error?.response?.data?.message || 'Unable to mark attendance.');
    } finally {
      setSubmitting(false);
    }
  };

  const dialog = (
    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-sky-600" />
            Confirm Work Type
          </DialogTitle>
          <DialogDescription>{helperText}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900">
            <div className="flex items-start gap-2">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
              <p>Location is used only for attendance verification and is captured only at punch time.</p>
            </div>
          </div>

          {locationMessage ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              {locationMessage}
            </div>
          ) : null}

          <div className="grid gap-3">
            {[
              { value: 'WFO' as WorkType, label: 'Work From Office (WFO)' },
              { value: 'WFH' as WorkType, label: 'Work From Home (WFH)' },
              { value: 'ON_SITE' as WorkType, label: 'On-site / Client Location' },
            ].map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setSelectedWorkType(option.value)}
                className={`rounded-xl border px-4 py-3 text-left text-sm transition ${
                  selectedWorkType === option.value
                    ? 'border-sky-500 bg-sky-50 text-sky-900'
                    : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                <div className="font-medium">{option.label}</div>
                {suggestedWorkType === option.value ? (
                  <div className="mt-1 text-xs text-sky-700">Recommended based on your current location</div>
                ) : null}
              </button>
            ))}
          </div>

          {coords ? (
            <div className="text-xs text-slate-500">
              GPS captured at {coords.latitude.toFixed(5)}, {coords.longitude.toFixed(5)}
              {typeof coords.accuracy === 'number' ? ` (accuracy ${Math.round(coords.accuracy)}m)` : ''}
            </div>
          ) : (
            <div className="text-xs text-slate-500">
              GPS was not available, so your punch will continue with manual work type selection.
            </div>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button type="button" onClick={() => void confirmPunchIn()} disabled={submitting}>
            {submitting ? 'Submitting...' : 'Confirm Swipe In'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  return {
    beginPunchIn,
    dialog,
    submitting,
  };
};

