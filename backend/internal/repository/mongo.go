package repository

import (
	"context"
	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
	"go.mongodb.org/mongo-driver/v2/mongo/options"
	"time"
)

type Store interface {
	Aggregate(context.Context, string, mongo.Pipeline, any) error
	Allow(context.Context, string, int) (bool, error)
	Get(context.Context, string, bson.M, any) error
	List(context.Context, string, bson.M, bson.D, int64, int64, any) error
	Count(context.Context, string, bson.M) (int64, error)
	Insert(context.Context, string, any) error
	Replace(context.Context, string, string, any) error
	Transaction(context.Context, func(context.Context) error) error
}
type Mongo struct{ DB *mongo.Database }

func (m *Mongo) Get(ctx context.Context, c string, f bson.M, out any) error {
	return m.DB.Collection(c).FindOne(ctx, f).Decode(out)
}
func (m *Mongo) List(ctx context.Context, c string, f bson.M, sort bson.D, skip, limit int64, out any) error {
	o := options.Find().SetSort(sort).SetSkip(skip)
	if limit > 0 {
		o.SetLimit(limit)
	}
	cur, err := m.DB.Collection(c).Find(ctx, f, o)
	if err != nil {
		return err
	}
	defer cur.Close(ctx)
	return cur.All(ctx, out)
}
func (m *Mongo) Count(ctx context.Context, c string, f bson.M) (int64, error) {
	return m.DB.Collection(c).CountDocuments(ctx, f)
}
func (m *Mongo) Insert(ctx context.Context, c string, v any) error {
	_, e := m.DB.Collection(c).InsertOne(ctx, v)
	return e
}
func (m *Mongo) Replace(ctx context.Context, c, id string, v any) error {
	r, e := m.DB.Collection(c).ReplaceOne(ctx, bson.M{"_id": id}, v)
	if e == nil && r.MatchedCount == 0 {
		return mongo.ErrNoDocuments
	}
	return e
}
func (m *Mongo) Transaction(ctx context.Context, fn func(context.Context) error) error {
	session, e := m.DB.Client().StartSession()
	if e != nil {
		return e
	}
	defer session.EndSession(ctx)
	_, e = session.WithTransaction(ctx, func(tx context.Context) (any, error) { return nil, fn(tx) })
	return e
}
func (m *Mongo) EnsureIndexes(ctx context.Context) error {
	definitions := map[string][]mongo.IndexModel{
		"rate_limits":      {{Keys: bson.D{{Key: "expiresAt", Value: 1}}, Options: options.Index().SetExpireAfterSeconds(0)}},
		"cinemas":          {{Keys: bson.D{{Key: "code", Value: 1}}, Options: options.Index().SetUnique(true)}},
		"staff":            {{Keys: bson.D{{Key: "staffCode", Value: 1}}, Options: options.Index().SetUnique(true)}, {Keys: bson.D{{Key: "cinemaId", Value: 1}, {Key: "status", Value: 1}}}},
		"staff_qr_codes":   {{Keys: bson.D{{Key: "publicToken", Value: 1}}, Options: options.Index().SetUnique(true)}, {Keys: bson.D{{Key: "staffId", Value: 1}}, Options: options.Index().SetUnique(true)}},
		"feedback_reasons": {{Keys: bson.D{{Key: "code", Value: 1}}, Options: options.Index().SetUnique(true)}},
		"feedbacks":        {},
		"coaching":         {{Keys: bson.D{{Key: "cinemaId", Value: 1}, {Key: "followUpDate", Value: 1}}}},
		"audit_logs":       {{Keys: bson.D{{Key: "cinemaId", Value: 1}, {Key: "createdAt", Value: -1}}}},
	}
	for _, key := range []string{"staff.id", "cinema.id", "customer.phone", "rating.value", "reasons.code"} {
		definitions["feedbacks"] = append(definitions["feedbacks"], mongo.IndexModel{Keys: bson.D{{Key: key, Value: 1}, {Key: "createdAt", Value: -1}}})
	}
	for c, defs := range definitions {
		if _, e := m.DB.Collection(c).Indexes().CreateMany(ctx, defs); e != nil {
			return e
		}
	}
	return nil
}
func Connect(ctx context.Context, uri, db string) (*Mongo, error) {
	c, e := mongo.Connect(options.Client().ApplyURI(uri).SetTimeout(10 * time.Second))
	if e != nil {
		return nil, e
	}
	if e = c.Ping(ctx, nil); e != nil {
		return nil, e
	}
	m := &Mongo{DB: c.Database(db)}
	return m, m.EnsureIndexes(ctx)
}

// Allow uses atomic MongoDB counters so limits hold across API replicas.
func (m *Mongo) Allow(ctx context.Context, key string, max int) (bool, error) {
	now := time.Now().UTC()
	id := key + ":" + now.Truncate(time.Minute).Format(time.RFC3339)
	var out struct {
		Count int `bson:"count"`
	}
	e := m.DB.Collection("rate_limits").FindOneAndUpdate(ctx, bson.M{"_id": id}, bson.M{"$inc": bson.M{"count": 1}, "$setOnInsert": bson.M{"expiresAt": now.Add(2 * time.Minute)}}, options.FindOneAndUpdate().SetUpsert(true).SetReturnDocument(options.After)).Decode(&out)
	return out.Count <= max, e
}

func (m *Mongo) Aggregate(ctx context.Context, c string, p mongo.Pipeline, out any) error {
	cur, e := m.DB.Collection(c).Aggregate(ctx, p)
	if e != nil {
		return e
	}
	defer cur.Close(ctx)
	return cur.All(ctx, out)
}
