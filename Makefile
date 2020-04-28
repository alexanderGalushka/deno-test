build:
	docker build -t deno-test .

run: build
	docker run -p 8080:8080 deno-test