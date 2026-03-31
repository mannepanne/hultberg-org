// ABOUT: Timeline component for /now page snapshots
// ABOUT: Renders interactive timeline, handles navigation, loads snapshot content

(function() {
  'use strict';

  let snapshots = [];
  let currentContent = null;
  let selectedIndex = 0;

  /**
   * Initialize the timeline component
   */
  async function initTimeline() {
    try {
      // Fetch snapshots index
      const response = await fetch('/now/snapshots/index.json');

      if (!response.ok) {
        // No snapshots yet, hide timeline
        console.log('No snapshots found, timeline disabled');
        document.querySelector('.timeline-container').style.display = 'none';
        return;
      }

      const data = await response.json();
      snapshots = data.snapshots || [];

      if (snapshots.length === 0) {
        document.querySelector('.timeline-container').style.display = 'none';
        return;
      }

      // Add current content as the latest "snapshot"
      const currentDate = new Date();
      const currentDateStr = currentDate.toISOString().substring(0, 7); // YYYY-MM format

      currentContent = {
        date: 'current',
        displayDate: currentDateStr,
        snapshotDate: currentDate.toISOString(),
        preview: 'Current /now content',
        isCurrent: true
      };

      // Add current content to the end of snapshots array
      snapshots.push(currentContent);

      // Sort snapshots by date (oldest first for correct ordering)
      snapshots.sort((a, b) => {
        if (a.date === 'current') return 1;
        if (b.date === 'current') return -1;
        return a.date.localeCompare(b.date);
      });

      // Check for URL parameter to pre-select a snapshot
      const urlParams = new URLSearchParams(window.location.search);
      const dateParam = urlParams.get('date');

      if (dateParam && dateParam !== 'current') {
        const index = snapshots.findIndex(s => s.date === dateParam);
        if (index !== -1) {
          selectedIndex = index;
          await loadSnapshotContent(snapshots[selectedIndex]);
        } else {
          // Invalid date parameter, default to current
          selectedIndex = snapshots.length - 1;
        }
      } else {
        // Default to current content (last in array)
        selectedIndex = snapshots.length - 1;
      }

      renderTimeline();
    } catch (error) {
      console.error('Error initializing timeline:', error);
      document.querySelector('.timeline-container').style.display = 'none';
    }
  }

  /**
   * Render the timeline with 5 visible nodes
   */
  function renderTimeline() {
    const timelineBar = document.getElementById('timeline-bar');
    timelineBar.innerHTML = '';

    // Calculate which snapshots to show (selected + 2 on each side)
    const visibleIndices = calculateVisibleIndices(selectedIndex, snapshots.length);

    // Add connecting line
    const line = document.createElement('div');
    line.className = 'timeline-line';
    timelineBar.appendChild(line);

    // Left arrow
    const leftArrow = createArrowButton('left', selectedIndex > 0);
    timelineBar.appendChild(leftArrow);

    // Render visible snapshots
    visibleIndices.forEach((index, position) => {
      if (index === null) {
        // Placeholder for future
        const placeholder = createPlaceholderNode();
        timelineBar.appendChild(placeholder);
      } else {
        const node = createTimelineNode(index, position);
        timelineBar.appendChild(node);
      }
    });

    // Right arrow
    const rightArrow = createArrowButton('right', selectedIndex < snapshots.length - 1);
    timelineBar.appendChild(rightArrow);
  }

  /**
   * Calculate which snapshot indices should be visible
   * Returns array of indices with center position being selected
   * null values represent placeholders for future snapshots
   * Desktop: 7 nodes (center + 3 on each side)
   * Mobile: 5 nodes (center + 2 on each side)
   */
  function calculateVisibleIndices(selected, total) {
    const indices = [];

    // Check if desktop (wider than 768px) for 7 nodes, otherwise 5 nodes
    const isDesktop = window.innerWidth > 768;
    const range = isDesktop ? 3 : 2;

    // Show: selected-range, ..., selected, ..., selected+range
    for (let offset = -range; offset <= range; offset++) {
      const index = selected + offset;
      if (index >= 0 && index < total) {
        indices.push(index);
      } else if (index >= total) {
        // Future placeholder (beyond current)
        indices.push(null);
      }
    }

    return indices;
  }

  /**
   * Create a timeline node element
   * @param {number} index - Snapshot index in array
   * @param {number} position - Position in visible array (0-4)
   */
  function createTimelineNode(index, position) {
    const snapshot = snapshots[index];
    const isSelected = index === selectedIndex;

    // Calculate distance from center (0 = center, 1 = adjacent, 2 = edge)
    const centerPosition = Math.floor(calculateVisibleIndices(selectedIndex, snapshots.length).length / 2);
    const distance = Math.abs(position - centerPosition);

    const node = document.createElement('div');

    if (distance === 0) {
      // Center (selected) - large
      node.className = 'timeline-node timeline-node--large';
      node.textContent = formatDate(snapshot);
    } else if (distance === 1) {
      // Adjacent - medium with date
      node.className = 'timeline-node timeline-node--medium';
      node.textContent = formatDate(snapshot);
    } else {
      // Edge - small shape only
      node.className = 'timeline-node timeline-node--small';
      node.setAttribute('aria-label', formatDate(snapshot));
    }

    node.setAttribute('data-index', index);
    node.setAttribute('role', 'button');
    node.setAttribute('tabindex', '0');

    // Click handler
    node.addEventListener('click', () => selectSnapshot(index));

    // Keyboard handler
    node.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        selectSnapshot(index);
      }
    });

    return node;
  }

  /**
   * Create a placeholder node for future snapshots
   */
  function createPlaceholderNode() {
    const node = document.createElement('div');
    node.className = 'timeline-node timeline-node--placeholder';
    node.textContent = '?';
    node.setAttribute('aria-label', 'Future snapshot');
    node.setAttribute('role', 'presentation');
    return node;
  }

  /**
   * Format snapshot date for display (YYYY-MM format)
   */
  function formatDate(snapshot) {
    if (snapshot.isCurrent) {
      return snapshot.displayDate;
    }

    // Parse YYYYMMDD to YYYY-MM
    const year = snapshot.date.substring(0, 4);
    const month = snapshot.date.substring(4, 6);
    return `${year}-${month}`;
  }

  /**
   * Create arrow button
   */
  function createArrowButton(direction, enabled) {
    const button = document.createElement('button');
    button.className = 'timeline-arrow';
    button.innerHTML = direction === 'left' ? '←' : '→';
    button.disabled = !enabled;
    button.setAttribute('aria-label', direction === 'left' ? 'Previous snapshots' : 'Next snapshots');

    if (enabled) {
      button.addEventListener('click', () => shiftTimeline(direction));
    }

    return button;
  }

  /**
   * Shift timeline left (earlier) or right (later)
   */
  function shiftTimeline(direction) {
    if (direction === 'left' && selectedIndex > 0) {
      selectSnapshot(selectedIndex - 1);
    } else if (direction === 'right' && selectedIndex < snapshots.length - 1) {
      selectSnapshot(selectedIndex + 1);
    }
  }

  /**
   * Select a snapshot and center it in timeline
   */
  async function selectSnapshot(index) {
    if (index === selectedIndex) return;

    selectedIndex = index;
    const snapshot = snapshots[index];

    // Update URL without reload
    const url = new URL(window.location);
    if (snapshot.isCurrent) {
      url.searchParams.delete('date');
    } else {
      url.searchParams.set('date', snapshot.date);
    }
    window.history.pushState({}, '', url);

    // Load snapshot content
    await loadSnapshotContent(snapshot);

    // Re-render timeline
    renderTimeline();

    // Scroll to top smoothly
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  /**
   * Load and display snapshot content
   */
  async function loadSnapshotContent(snapshot) {
    const contentDiv = document.getElementById('now-content');

    // If current content, restore original and exit
    if (snapshot.isCurrent) {
      // Original content is already loaded
      return;
    }

    try {
      // Show loading state
      contentDiv.style.opacity = '0.5';

      // Fetch snapshot JSON
      const response = await fetch(`/now/snapshots/${snapshot.date}.json`);

      if (!response.ok) {
        throw new Error('Snapshot not found');
      }

      const snapshotData = await response.json();

      // Render markdown to HTML (using marked.js if available)
      let html;
      if (typeof marked !== 'undefined') {
        html = await marked.parse(snapshotData.markdown);
      } else {
        // Fallback: simple markdown-ish rendering
        html = snapshotData.markdown
          .replace(/\n\n/g, '</p><p>')
          .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
          .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2">$1</a>');
        html = `<p>${html}</p>`;
      }

      // Replace content
      contentDiv.innerHTML = html;
      contentDiv.style.opacity = '1';

    } catch (error) {
      console.error('Error loading snapshot:', error);

      // Show error in content area
      contentDiv.innerHTML = '<p><em>⚠️ Could not load snapshot. <a href="/now">View current</a></em></p>';
      contentDiv.style.opacity = '1';
    }
  }

  /**
   * Handle browser back/forward
   */
  window.addEventListener('popstate', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const dateParam = urlParams.get('date');

    let newIndex;
    if (dateParam && dateParam !== 'current') {
      newIndex = snapshots.findIndex(s => s.date === dateParam);
      if (newIndex === -1) {
        newIndex = snapshots.length - 1; // Default to current
      }
    } else {
      newIndex = snapshots.length - 1; // Current content
    }

    if (newIndex !== selectedIndex) {
      selectedIndex = newIndex;
      await loadSnapshotContent(snapshots[selectedIndex]);
      renderTimeline();
    }
  });

  /**
   * Handle window resize to adjust number of visible nodes
   */
  let resizeTimeout;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
      renderTimeline();
    }, 250);
  });

  // Initialize on page load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initTimeline);
  } else {
    initTimeline();
  }

})();
