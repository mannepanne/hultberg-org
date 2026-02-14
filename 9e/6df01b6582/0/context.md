# Session Context

## User Prompts

### Prompt 1

Please familiarise yourself with this project by reading @CLAUDE.md and checking out the project structure. Can you tell me what this project is about?

### Prompt 2

Hmm. But that can't be right. The project is deployed to CloudFlare on https://hultberg.org and is serving the pages as expected.

### Prompt 3

Excellent. Do you need to update something in @CLAUDE.md to make this clear? If a developer comes new to the project, they should be able to read the project top level @CLAUDE.md and quickly get up to speed so they can be productive.

### Prompt 4

Can I somehow run this site locally for purposes of checking development changes?

### Prompt 5

Yes please.

### Prompt 6

Excellent! Let's try updating the /now page. It's the file @public/now/index.html 

First of all, make a copy of the file and save it as a backup using the same file name format at as the previous backups in the same folder, for example @public/now/index_20160926.CHANGED.html

### Prompt 7

I no longer work at Ocado Technology, so the first sentence and the first bullet in the list below need to change. I know work at char.gy (https://char.gy) where we design, manufacture, install and operate EV chargers. By strategically installing charge points along residential streets, we bring convenient, reliable, and affordable charging directly to drivers’ doorsteps.

### Prompt 8

There's a spelling mistake in the second bullet, change "abtch" to "batch". The age of my asparagus bed also needs to change from four years to five. And change "harvested my second batch" to "looking forward to harvesting more asparagus spears this year".

### Prompt 9

Third bullet also needs changing. I now work out 2 days a week while trying to repair the longitudinal splits in bicep tendons in my right arm... Over a year in the making, but slowly getting there. I hope.

### Prompt 10

Great! Please commit these changes (and other changes in the project, I have for example deleted two old files). The give me the command to push to GitHub.

### Prompt 11

Great, looks perfect. How do we work together using proper pull requests? I would like to understand how I can use you to create pull requests as well as review them.

### Prompt 12

Let's wait a bit, and discuss an actual new feature in the site first. And when we work on actually implementing it (after creating a specification together) we can move on to using pull requests.

### Prompt 13

I would like to introduce a super simple blog feature. Yes, let's talk this through, and save the plan for it as a Markdown file in @SPECIFICATIONS/ 

The blog posts should all be listed with a title and excerpt on a sub page in the site, like /updates

The title of each post should be linked to the post itself, and show the whole thing, mauybe we use a "slug" in the URL so a blog post with the title "Using Claude Code to implement a blog feature" is accessed on /updates/using-claude-code-to-imp...

### Prompt 14

Great questions! I'll answer the functionality questions first, and then we can talk about the storage, I'd like to understand the options better.

It would be great to use the CloudFlare CDN for images. Is it free / included in my account? I have a subscription for "Workers Paid" in my account. I would like to upload quite large images, but on upload they should be resized to never be larger than fitting within a square of 800 by 800 picels (retaining the aspect ratio). So we can show a small v...

### Prompt 15

I agree with your recommendation. Let's not use the word "posts" anywhere though, let's call it "updates".

In your quick check, yes, looks good. But a question: can we make sure I can add more than one image per post?

### Prompt 16

I like option 2, let's go with that.

Yes, let's talk storage. I think KV storage sounds tricky. And I just thought of something else. Could we store the content (the updates themselves as json maybe, but also the images) using GitHub Pages? And still get URLs like "hultberg.org/updates/slug-here" to browse the content?

### Prompt 17

I love the sound of option 2! Let's do that. But the delay in publishing to the site means that it puts great emphasis on being able to work on updates and save them as drafts until done, and having a good preview. Will that be possible?

### Prompt 18

This sounds awesome. Put what we have said so far in a clear and well structured step by step implementation plain in the SPECIFICATIONS folder. Name the file "blog-style-updates-mvp.md". Start the file with epxlaining what the feature is.

### Prompt 19

I think that looks great! I'd love for us to do this using pull requests, so start a new branch before starting any implementation work. And I think the first commit to the branch should be the specification!

Any questions on the implementation approach? I agree with using resend.com for emails.

### Prompt 20

Guide me through the GitHub access token please. 

The Resend API key is: REDACTED

Please make sure this is put in a config file that isn't commited to the repo. I assume this will be stored as a secret in CloudFlare?

### Prompt 21

For the GitHub token, I set it to work for the repo hultberg-org only, but it's asking for permissions. What permissions do I need to give it?

### Prompt 22

Ok! I have the token. Should I run the npx wrangler commands to set the GitHub toke and Resend API key now?

### Prompt 23

Ok, both secrets now set. What next? Admin UI approach? What are my options?

### Prompt 24

With regards to styling I agree with Option B. But for the Markdown editor I am quite intrigued by the SimpleMDE/EasyMDE Library option. I don't mind the dependency. But what's the main differences between SimpleMDE and EasyMDE?

### Prompt 25

Yes, go with EasyMDE! Please update the spec with these decisions we've done lately so it's up to date.

