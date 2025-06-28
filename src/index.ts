// ABOUT: The main entry point for the Cloudflare Worker.
// ABOUT: This file handles all incoming requests and routes them accordingly.

export default {
  async fetch(request: Request, env: any, ctx: any): Promise<Response> {
    // This is the logic for dynamic requests, not static assets.
    // If a request doesn't match a static asset, it will fall through to this.
    const notFoundHtml = `<!doctype html>
<html class="no-js" lang="en-GB">
<head>
	<meta charset="utf-8">
	<meta http-equiv="X-UA-Compatible" content="IE=edge">
	<title>Magnus Hultberg - hultberg.org</title>
	<meta name="viewport" content="width=device-width, initial-scale=1">

<script>
  (function(i,s,o,g,r,a,m){i['GoogleAnalyticsObject']=r;i[r]=i[r]||function(){
  (i[r].q=i[r].q||[]).push(arguments)},i[r].l=1*new Date();a=s.createElement(o),
  m=s.getElementsByTagName(o)[0];a.async=1;a.src=g;m.parentNode.insertBefore(a,m)
  })(window,document,'script','//www.google-analytics.com/analytics.js','ga');

  ga('create', 'UA-291574-7', 'auto');
  ga('send', 'pageview');
</script>

</head>
<body>

<div>

<img src="/errors/bazinga.gif" alt="bazinga!" /><br /><br />
sorry, the page or file you are looking for isn't here...<br />
<a href="javascript:history.back()">go back from whence you came</a>, or tell me what a klutz I am @<a href="https://twitter.com/manne">manne</a>, <a href="https://uk.linkedin.com/in/hultberg">LinkedIn</a>

</div>

</body>
</html>`;
    return new Response(notFoundHtml, {
      status: 404,
      headers: {
        'Content-Type': 'text/html',
      },
    });
  },
};