// ABOUT: Client-side JavaScript for GitHub widget on /now page
// ABOUT: Fetches and renders contribution graph and recent repositories

(function() {
  'use strict';

  const MAX_REPOS = 10; // Maximum number of repos to display
  const ACTIVITY_CUTOFF_DAYS = 21; // Don't show "X days ago" after this many days
  const FETCH_TIMEOUT_MS = 10000; // 10 second timeout for API calls

  /**
   * Fetch with timeout support
   * @param {string} url - URL to fetch
   * @param {number} timeout - Timeout in milliseconds
   * @returns {Promise<Response>}
   */
  async function fetchWithTimeout(url, timeout = FETCH_TIMEOUT_MS) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        throw new Error('Request timed out');
      }
      throw error;
    }
  }

  /**
   * Fetches public repositories from GitHub REST API
   */
  async function fetchRepositories(username) {
    try {
      const response = await fetchWithTimeout(
        `https://api.github.com/users/${username}/repos?sort=pushed&per_page=100`
      );

      if (!response.ok) {
        throw new Error(`GitHub API returned ${response.status}`);
      }

      const repos = await response.json();

      // Filter to only repos owned by user (not forks) and sort by most recent push
      return repos
        .filter(repo => !repo.fork && repo.owner.login === username)
        .sort((a, b) => new Date(b.pushed_at) - new Date(a.pushed_at))
        .slice(0, MAX_REPOS);
    } catch (error) {
      console.error('Failed to fetch repositories:', error);
      return [];
    }
  }

  /**
   * Fetches contribution data from our Worker proxy
   */
  async function fetchContributions(username) {
    try {
      const response = await fetchWithTimeout(
        `/api/github/contributions?username=${username}`
      );

      if (!response.ok) {
        throw new Error(`Contributions API returned ${response.status}`);
      }

      const data = await response.json();
      return data.data?.user?.contributionsCollection?.contributionCalendar;
    } catch (error) {
      console.error('Failed to fetch contributions:', error);
      return null;
    }
  }

  /**
   * Formats a date as "X days ago" or "today"
   */
  function formatDaysAgo(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now - date);
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'today';
    if (diffDays > ACTIVITY_CUTOFF_DAYS) return '';
    return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
  }

  /**
   * Gets the contribution level color based on count
   * Matches GitHub's color scheme
   */
  function getContributionColor(count) {
    if (count === 0) return '#ebedf0';
    if (count < 3) return '#9be9a8';
    if (count < 6) return '#40c463';
    if (count < 9) return '#30a14e';
    return '#216e39';
  }

  /**
   * Renders the contribution graph
   * Uses DOM methods to prevent XSS from untrusted GitHub API data
   */
  function renderContributionGraph(calendar, container) {
    // Clear existing content
    container.innerHTML = '';

    if (!calendar) {
      const message = document.createElement('p');
      message.textContent = 'Unable to load contribution data.';
      container.appendChild(message);
      return;
    }

    const { weeks, totalContributions } = calendar;

    // Show only last 26 weeks (approximately 6 months)
    const recentWeeks = weeks.slice(-26);

    // Create month labels
    const monthLabels = [];
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    let lastMonth = -1;

    recentWeeks.forEach((week, weekIndex) => {
      const firstDay = week.contributionDays[0];
      if (firstDay) {
        const date = new Date(firstDay.date);
        const month = date.getMonth();
        if (month !== lastMonth && weekIndex > 0) {
          monthLabels.push({ weekIndex, label: monthNames[month] });
          lastMonth = month;
        }
      }
    });

    // Create main container
    const graphContainer = document.createElement('div');
    graphContainer.className = 'contribution-graph';

    // Create month labels container
    const monthLabelsDiv = document.createElement('div');
    monthLabelsDiv.className = 'month-labels';
    monthLabels.forEach(({ weekIndex, label }) => {
      const span = document.createElement('span');
      span.style.gridColumn = `${weekIndex + 1}`;
      span.textContent = label; // Safe: controlled by our code
      monthLabelsDiv.appendChild(span);
    });
    graphContainer.appendChild(monthLabelsDiv);

    // Create contribution grid
    const gridDiv = document.createElement('div');
    gridDiv.className = 'contribution-grid';
    gridDiv.setAttribute('role', 'img');
    gridDiv.setAttribute('aria-label', 'GitHub contribution activity for the last 6 months');

    recentWeeks.forEach(week => {
      const weekDiv = document.createElement('div');
      weekDiv.className = 'week';

      week.contributionDays.forEach(day => {
        const color = getContributionColor(day.contributionCount);
        const contributionText = day.contributionCount === 1 ? 'contribution' : 'contributions';
        const label = `${day.contributionCount} ${contributionText} on ${day.date}`;

        const dayDiv = document.createElement('div');
        dayDiv.className = 'day';
        dayDiv.style.backgroundColor = color; // Safe: color from our getContributionColor function
        dayDiv.title = label; // Safe: DOM properties escape HTML
        dayDiv.setAttribute('aria-label', label); // Safe: setAttribute escapes
        weekDiv.appendChild(dayDiv);
      });

      gridDiv.appendChild(weekDiv);
    });
    graphContainer.appendChild(gridDiv);

    // Create total contributions text
    const totalDiv = document.createElement('div');
    totalDiv.className = 'contribution-total';
    totalDiv.textContent = `${totalContributions.toLocaleString()} contributions in the last 12 months`; // Safe: textContent escapes
    graphContainer.appendChild(totalDiv);

    container.appendChild(graphContainer);
  }

  /**
   * Renders the repository list
   * Uses DOM methods to prevent XSS from untrusted GitHub API data
   */
  function renderRepositories(repos, container) {
    // Clear existing content
    container.innerHTML = '';

    if (!repos || repos.length === 0) {
      const message = document.createElement('p');
      message.textContent = 'No recent repositories found.';
      container.appendChild(message);
      return;
    }

    const repoList = document.createElement('div');
    repoList.className = 'repo-list';

    repos.forEach(repo => {
      const daysAgo = formatDaysAgo(repo.pushed_at);
      const description = repo.description || 'No description available';

      // Create repo item container
      const repoItem = document.createElement('div');
      repoItem.className = 'repo-item';

      // Create header with name and activity
      const repoHeader = document.createElement('div');
      repoHeader.className = 'repo-header';

      // Create link (href is validated by browser, textContent prevents XSS)
      const repoLink = document.createElement('a');
      repoLink.href = repo.html_url;
      repoLink.className = 'repo-name';
      repoLink.target = '_blank';
      repoLink.rel = 'noopener noreferrer';
      repoLink.textContent = repo.name; // Safe: textContent escapes HTML
      repoHeader.appendChild(repoLink);

      // Add activity indicator if present
      if (daysAgo) {
        const activitySpan = document.createElement('span');
        activitySpan.className = 'repo-activity';
        activitySpan.textContent = daysAgo; // Safe: controlled by our code
        repoHeader.appendChild(activitySpan);
      }

      repoItem.appendChild(repoHeader);

      // Create description
      const descriptionDiv = document.createElement('div');
      descriptionDiv.className = 'repo-description';
      descriptionDiv.textContent = description; // Safe: textContent escapes HTML
      repoItem.appendChild(descriptionDiv);

      repoList.appendChild(repoItem);
    });

    container.appendChild(repoList);
  }

  /**
   * Initialize the GitHub widget
   */
  async function initGitHubWidget() {
    const contributionContainer = document.getElementById('github-contributions');
    const repoContainer = document.getElementById('github-repos');

    if (!contributionContainer || !repoContainer) {
      console.error('GitHub widget containers not found');
      return;
    }

    // Read username from data attribute (with fallback)
    const username = contributionContainer.dataset.username || 'mannepanne';

    // Show loading state
    contributionContainer.innerHTML = '<p>Loading contributions...</p>';
    repoContainer.innerHTML = '<p>Loading repositories...</p>';

    // Fetch data in parallel
    const [contributions, repos] = await Promise.all([
      fetchContributions(username),
      fetchRepositories(username)
    ]);

    // Render the data
    renderContributionGraph(contributions, contributionContainer);
    renderRepositories(repos, repoContainer);
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initGitHubWidget);
  } else {
    initGitHubWidget();
  }
})();
