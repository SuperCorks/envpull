.PHONY: build test lint install clean fmt vet

VERSION ?= dev
COMMIT := $(shell git rev-parse --short HEAD 2>/dev/null || echo "none")
DATE := $(shell date -u +%Y-%m-%dT%H:%M:%SZ)
LDFLAGS := -X github.com/supercorks/envpull/pkg/version.Version=$(VERSION) \
           -X github.com/supercorks/envpull/pkg/version.Commit=$(COMMIT) \
           -X github.com/supercorks/envpull/pkg/version.BuildDate=$(DATE)

build:
	go build -ldflags "$(LDFLAGS)" -o bin/envpull ./cmd/envpull

test:
	go test -race -cover ./...

lint:
	golangci-lint run

vet:
	go vet ./...

fmt:
	gofmt -s -w .

install: build
	cp bin/envpull /usr/local/bin/

clean:
	rm -rf bin/

# Development helpers
run:
	go run ./cmd/envpull $(ARGS)

tidy:
	go mod tidy

# Build for all platforms
build-all:
	GOOS=darwin GOARCH=amd64 go build -ldflags "$(LDFLAGS)" -o bin/envpull-darwin-amd64 ./cmd/envpull
	GOOS=darwin GOARCH=arm64 go build -ldflags "$(LDFLAGS)" -o bin/envpull-darwin-arm64 ./cmd/envpull
	GOOS=linux GOARCH=amd64 go build -ldflags "$(LDFLAGS)" -o bin/envpull-linux-amd64 ./cmd/envpull
	GOOS=linux GOARCH=arm64 go build -ldflags "$(LDFLAGS)" -o bin/envpull-linux-arm64 ./cmd/envpull
	GOOS=windows GOARCH=amd64 go build -ldflags "$(LDFLAGS)" -o bin/envpull-windows-amd64.exe ./cmd/envpull
