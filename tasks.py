from invoke import task

@task
def start(ctx):
    ctx.run("py3 src/app.py")

@task
def coverage(ctx):
    ctx.run("coverage run --branch -m pytest")

@task()
def coverage_report(ctx):
    ctx.run("coverage html")
