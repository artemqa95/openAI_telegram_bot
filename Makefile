build:
	docker build -t nn-bot .

run:
	docker run -d -p 3000:3000 --name coolbot --rm nn-bot