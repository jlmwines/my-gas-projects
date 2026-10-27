/**
 * @file BusinessHours.js
 * @description The Israeli business window the frequent pipeline runs in, in one place:
 * Sun-Thu 08:00-20:00, Fri 08:00-13:00, Sat off (Asia/Jerusalem). Used by
 * HousekeepingService.performFrequentMaintenance (the cadence guard) and the Woo Orders
 * dashboard heartbeat, so the pull schedule and its staleness check cannot drift apart.
 */

const BusinessHours = (function() {
  const TZ = 'Asia/Jerusalem';

  /**
   * @param {Date} date
   * @returns {boolean} True if date falls inside the business window.
   */
  function isInWindow(date) {
    const parts = Utilities.formatDate(date, TZ, 'EEE H').split(' ');
    const dayName = parts[0];
    const hour = parseInt(parts[1], 10);
    const isSunThu = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu'].indexOf(dayName) >= 0;
    const isFri = dayName === 'Fri';
    return (isSunThu && hour >= 8 && hour < 20) || (isFri && hour >= 8 && hour < 13);
  }

  /**
   * Minutes between from and to that fall inside the business window, sampled in
   * 5-minute steps (window edges are on the hour, so the error is under 5 minutes).
   * Capped at 7 days of span: anything older is stale under any threshold anyway.
   * @param {Date} from
   * @param {Date} to
   * @returns {number}
   */
  function minutesInWindowBetween(from, to) {
    const STEP_MS = 5 * 60000;
    const start = Math.max(from.getTime(), to.getTime() - 7 * 24 * 60 * 60000);
    let minutes = 0;
    for (let t = start; t < to.getTime(); t += STEP_MS) {
      if (isInWindow(new Date(t))) minutes += 5;
    }
    return minutes;
  }

  return {
    isInWindow: isInWindow,
    minutesInWindowBetween: minutesInWindowBetween
  };
})();
