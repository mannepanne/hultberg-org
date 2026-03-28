// ABOUT: Client-side JavaScript for GitHub widget on /now page
// ABOUT: Fetches and renders contribution graph and recent repositories

(function() {
  'use strict';

  const MAX_REPOS = 10; // Maximum number of repos to display
  const ACTIVITY_CUTOFF_DAYS = 21; // Don't show "X days ago" after this many days

  /**
   * Fetches public repositories from GitHub REST API
   */
  async function fetchRepositories(username) {
    try {
      const response = await fetch(
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
      const response = await fetch(
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
   */
  function renderContributionGraph(calendar, container) {
    if (!calendar) {
      container.innerHTML = '<p>Unable to load contribution data.</p>';
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

    // Build HTML
    let html = '<div class="contribution-graph">';

    // Month labels
    html += '<div class="month-labels">';
    monthLabels.forEach(({ weekIndex, label }) => {
      html += `<span style="grid-column: ${weekIndex + 1}">${label}</span>`;
    });
    html += '</div>';

    // Grid of contribution squares
    html += '<div class="contribution-grid" role="img" aria-label="GitHub contribution activity for the last 6 months">';
    recentWeeks.forEach(week => {
      html += '<div class="week">';
      week.contributionDays.forEach(day => {
        const color = getContributionColor(day.contributionCount);
        const contributionText = day.contributionCount === 1 ? 'contribution' : 'contributions';
        html += `<div class="day" style="background-color: ${color}" title="${day.contributionCount} ${contributionText} on ${day.date}" aria-label="${day.contributionCount} ${contributionText} on ${day.date}"></div>`;
      });
      html += '</div>';
    });
    html += '</div>';

    // Total contributions
    html += `<div class="contribution-total">${totalContributions.toLocaleString()} contributions in the last 12 months</div>`;

    html += '</div>';

    container.innerHTML = html;
  }

  /**
   * Renders the repository list
   */
  function renderRepositories(repos, container) {
    if (!repos || repos.length === 0) {
      container.innerHTML = '<p>No recent repositories found.</p>';
      return;
    }

    let html = '<div class="repo-list">';

    repos.forEach(repo => {
      const daysAgo = formatDaysAgo(repo.pushed_at);
      const description = repo.description || 'No description available';

      html += '<div class="repo-item">';
      html += `<div class="repo-header">`;
      html += `<a href="${repo.html_url}" class="repo-name" target="_blank" rel="noopener noreferrer">${repo.name}</a>`;
      if (daysAgo) {
        html += `<span class="repo-activity">${daysAgo}</span>`;
      }
      html += `</div>`;
      html += `<div class="repo-description">${description}</div>`;
      html += '</div>';
    });

    html += '</div>';

    container.innerHTML = html;
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
